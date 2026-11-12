-- =============================================================================
-- Rando Pleine Lune — fonctions métier, RLS et droits
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Outils internes (schéma privé, non exposé)
-- -----------------------------------------------------------------------------

-- Jeton dérivé par HMAC : imprévisible sans la clé serveur, régénérable côté
-- serveur (pour l'e-mail ou le lien de récupération), jamais stocké en clair.
create function private.derive_token(p_purpose text, p_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select rtrim(translate(encode(
    extensions.hmac(convert_to(p_purpose || ':' || p_id::text, 'UTF8'), s.token_hmac_key, 'sha256'),
    'base64'), '+/', '-_'), '=')
  from private.app_secrets s
$$;

create function private.token_hash(p_token text)
returns bytea
language sql immutable set search_path = ''
as $$ select extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256') $$;

-- Le QR code transporte uniquement un identifiant opaque (préfixe + jeton).
create function private.qr_token(p_attendee_id uuid)
returns text language sql stable set search_path = ''
as $$ select 'RPL1.' || private.derive_token('qr', p_attendee_id) $$;

create function private.access_token(p_reservation_id uuid)
returns text language sql stable set search_path = ''
as $$ select private.derive_token('access', p_reservation_id) $$;

create function private.raise_business_error(p_code text, p_detail text default null)
returns void language plpgsql set search_path = ''
as $$
begin
  -- Les codes métier sont repris tels quels par l'application (lib/errors.ts).
  raise exception using errcode = 'P0001', message = p_code, detail = coalesce(p_detail, '');
end;
$$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin' and anonymized_at is null
  )
$$;

create function private.require_admin()
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    perform private.raise_business_error('FORBIDDEN');
  end if;
end;
$$;

create function private.audit(p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = ''
as $$
  insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

create function private.cancellation_deadline(p_event public.events)
returns timestamptz language sql stable set search_path = ''
as $$
  select p_event.starts_at - make_interval(hours => coalesce(
    p_event.cancellation_deadline_hours,
    (select default_cancellation_deadline_hours from public.app_settings)))
$$;

create function private.payment_status_for(p_due int, p_paid int)
returns public.payment_status language sql immutable set search_path = ''
as $$
  select case
    when p_paid <= 0 and p_due > 0 then 'unpaid'::public.payment_status
    when p_paid < p_due then 'partial'::public.payment_status
    else 'paid'::public.payment_status
  end
$$;

-- Représentation d'une réservation pour le participant (avec QR codes).
create function private.reservation_json(p_reservation_id uuid, p_include_tokens boolean)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'participant_count', r.participant_count,
    'total_amount_cents', r.total_amount_cents,
    'created_at', r.created_at,
    'cancelled_at', r.cancelled_at,
    'cancelled_by', r.cancelled_by,
    'access_token', case when p_include_tokens then private.access_token(r.id) end,
    'can_cancel', r.status = 'confirmed'
                  and e.status in ('published', 'closed')
                  and now() < private.cancellation_deadline(e),
    'cancellation_deadline', private.cancellation_deadline(e),
    'contact', jsonb_build_object('first_name', p.first_name, 'last_name', p.last_name,
                                  'email', p.email, 'phone', p.phone),
    'payment', jsonb_build_object('status', pay.status, 'amount_due_cents', pay.amount_due_cents,
                                  'amount_paid_cents', pay.amount_paid_cents),
    'event', jsonb_build_object(
      'id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at,
      'meeting_point', e.meeting_point, 'meeting_point_url', e.meeting_point_url,
      'price_cents', e.price_cents, 'status', e.status, 'equipment', e.equipment,
      'instructions', e.instructions, 'cover_image', e.cover_image),
    'attendees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'position', a.position, 'first_name', a.first_name, 'last_name', a.last_name,
        'attendance_status', a.attendance_status, 'checked_in_at', a.checked_in_at,
        'qr_token', case when p_include_tokens and a.attendance_status <> 'cancelled'
                         then private.qr_token(a.id) end
      ) order by a.position)
      from public.reservation_attendees a where a.reservation_id = r.id
    ), '[]'::jsonb)
  )
  from public.reservations r
  join public.events e on e.id = r.event_id
  join public.profiles p on p.id = r.contact_profile_id
  left join public.payments pay on pay.reservation_id = r.id
  where r.id = p_reservation_id
$$;

create function private.enqueue(p_kind text, p_reservation_id uuid, p_dedupe_suffix text default '', p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_has_device boolean;
begin
  insert into public.notification_outbox (kind, channel, reservation_id, dedupe_key, payload)
  values (p_kind, 'email', p_reservation_id, p_kind || ':email:' || p_reservation_id || p_dedupe_suffix, p_payload)
  on conflict (dedupe_key) do nothing;

  select exists (
    select 1 from public.device_tokens d
    join public.reservations r on r.contact_profile_id = d.profile_id
    where r.id = p_reservation_id and d.revoked_at is null
  ) into v_has_device;

  if v_has_device then
    insert into public.notification_outbox (kind, channel, reservation_id, dedupe_key, payload)
    values (p_kind, 'push', p_reservation_id, p_kind || ':push:' || p_reservation_id || p_dedupe_suffix, p_payload)
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

-- Annulation commune (participant, administrateur, sortie annulée).
-- Les places ne sont libérées qu'une seule fois : la mise à jour du statut est
-- conditionnelle (confirmed -> cancelled) et le compteur n'est modifié que si
-- cette mise à jour a réellement eu lieu.
create function private.cancel_reservation_internal(p_reservation_id uuid, p_by text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_res public.reservations;
begin
  update public.reservations
     set status = 'cancelled', cancelled_at = now(), cancelled_by = p_by
   where id = p_reservation_id and status = 'confirmed'
  returning * into v_res;

  if not found then
    return false;
  end if;

  update public.events
     set seats_taken = seats_taken - v_res.participant_count, updated_at = now()
   where id = v_res.event_id;

  update public.reservation_attendees
     set attendance_status = 'cancelled'
   where reservation_id = v_res.id and attendance_status = 'expected';

  perform private.enqueue(
    case when p_by = 'event_cancelled' then 'event_cancelled' else 'reservation_cancelled' end,
    v_res.id);
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- Déclencheurs
-- -----------------------------------------------------------------------------
create function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end; $$;

create trigger events_touch before update on public.events
for each row execute function private.touch_updated_at();

create trigger app_settings_touch before update on public.app_settings
for each row execute function private.touch_updated_at();

create function private.events_defaults()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.capacity is null then
    new.capacity := (select default_capacity from public.app_settings);
  end if;
  new.seats_taken := 0;
  return new;
end;
$$;

create trigger events_defaults before insert on public.events
for each row execute function private.events_defaults();

-- Journalisation des modifications de sorties par un administrateur.
-- (Les variations du compteur de places ne sont pas journalisées.)
create function private.events_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null then
    perform private.audit(
      case tg_op when 'INSERT' then 'event.create' else 'event.update' end,
      'event', new.id,
      case tg_op when 'INSERT' then to_jsonb(new)
           else jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)) end);
  end if;
  return new;
end;
$$;

create trigger events_audit_insert after insert on public.events
for each row execute function private.events_audit();

create trigger events_audit_update
after update of title, summary, description, starts_at, ends_at, meeting_point, meeting_point_url,
  distance_km, elevation_m, difficulty, price_cents, capacity, equipment, instructions,
  cover_image, cancellation_deadline_hours, status
on public.events
for each row execute function private.events_audit();

-- Une sortie annulée annule toutes ses réservations et prévient les inscrits.
create function private.events_on_cancel()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.reservations where event_id = new.id and status = 'confirmed'
  loop
    perform private.cancel_reservation_internal(v_id, 'event_cancelled');
  end loop;
  return null;
end;
$$;

create trigger events_on_cancel after update of status on public.events
for each row when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
execute function private.events_on_cancel();

-- Le prix d'une sortie ayant des réservations ne change pas les montants dus
-- déjà enregistrés : le montant est figé à la réservation.

-- -----------------------------------------------------------------------------
-- API publique : réservation
-- -----------------------------------------------------------------------------
create function public.create_reservation(
  p_event_id uuid,
  p_idempotency_key uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_participant_count int,
  p_attendees jsonb default '[]'::jsonb,
  p_accept_terms boolean default false,
  p_accept_privacy boolean default false
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_settings public.app_settings;
  v_event public.events;
  v_existing public.reservations;
  v_first text := btrim(coalesce(p_first_name, ''));
  v_last text := btrim(coalesce(p_last_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_attendees jsonb := coalesce(p_attendees, '[]'::jsonb);
  v_profile_id uuid;
  v_res_id uuid := gen_random_uuid();
  v_attendee_id uuid;
  v_att_first text;
  v_att_last text;
  v_total int;
  i int;
begin
  if p_idempotency_key is null or p_event_id is null then
    perform private.raise_business_error('INVALID_INPUT', 'missing_key');
  end if;

  -- Protection contre les doubles clics / requêtes rejouées : la même clé
  -- d'idempotence renvoie la même réservation, sans en créer une seconde.
  perform pg_advisory_xact_lock(hashtextextended('idem:' || p_idempotency_key::text, 0));
  select * into v_existing from public.reservations where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.event_id <> p_event_id then
      perform private.raise_business_error('IDEMPOTENCY_CONFLICT');
    end if;
    return private.reservation_json(v_existing.id, true) || jsonb_build_object('replayed', true);
  end if;

  select * into v_settings from public.app_settings;

  -- Validation des saisies
  if p_accept_terms is not true or p_accept_privacy is not true then
    perform private.raise_business_error('CONSENT_REQUIRED');
  end if;
  if length(v_first) not between 1 and 80 or length(v_last) not between 1 and 80 then
    perform private.raise_business_error('INVALID_INPUT', 'name');
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform private.raise_business_error('INVALID_INPUT', 'email');
  end if;
  if v_phone is null or v_phone !~ '^\+?[0-9 ().-]{6,20}$' then
    perform private.raise_business_error('INVALID_INPUT', 'phone');
  end if;
  if p_participant_count is null
     or p_participant_count < 1
     or p_participant_count > v_settings.max_participants_per_reservation then
    perform private.raise_business_error('INVALID_INPUT', 'participant_count');
  end if;
  if jsonb_typeof(v_attendees) <> 'array'
     or (jsonb_array_length(v_attendees) not in (0, p_participant_count)) then
    perform private.raise_business_error('INVALID_INPUT', 'attendees');
  end if;

  -- Sérialise les réservations d'une même personne sur une même sortie.
  perform pg_advisory_xact_lock(hashtextextended('booking:' || p_event_id::text || ':' || v_email, 0));

  -- Limitation simple des tentatives par adresse e-mail.
  if (select count(*) from public.reservations r
        join public.profiles p on p.id = r.contact_profile_id
       where lower(p.email) = v_email and r.created_at > now() - interval '10 minutes') >= 5 then
    perform private.raise_business_error('TOO_MANY_REQUESTS');
  end if;

  if exists (select 1 from public.reservations r
               join public.profiles p on p.id = r.contact_profile_id
              where r.event_id = p_event_id and r.status = 'confirmed' and lower(p.email) = v_email) then
    perform private.raise_business_error('ALREADY_BOOKED');
  end if;

  -- Réservation atomique des places : la mise à jour conditionnelle verrouille
  -- la ligne de la sortie ; deux réservations simultanées sont sérialisées et
  -- la seconde réévalue la condition de capacité après la première.
  update public.events
     set seats_taken = seats_taken + p_participant_count
   where id = p_event_id
     and status = 'published'
     and starts_at > now()
     and seats_taken + p_participant_count <= capacity
  returning * into v_event;

  if not found then
    select * into v_event from public.events where id = p_event_id;
    if not found or v_event.status = 'draft' then
      perform private.raise_business_error('EVENT_NOT_FOUND');
    elsif v_event.status <> 'published' or v_event.starts_at <= now() then
      perform private.raise_business_error('EVENT_NOT_OPEN');
    else
      perform private.raise_business_error('EVENT_FULL', (v_event.capacity - v_event.seats_taken)::text);
    end if;
  end if;

  v_total := v_event.price_cents * p_participant_count;

  insert into public.profiles (first_name, last_name, email, phone, role)
  values (v_first, v_last, v_email, v_phone, 'participant')
  returning id into v_profile_id;

  insert into public.reservations (id, event_id, contact_profile_id, participant_count, status,
    total_amount_cents, idempotency_key, access_token_hash, terms_accepted_at, privacy_accepted_at)
  values (v_res_id, p_event_id, v_profile_id, p_participant_count, 'confirmed',
    v_total, p_idempotency_key, private.token_hash(private.access_token(v_res_id)), now(), now());

  for i in 1..p_participant_count loop
    if jsonb_array_length(v_attendees) > 0 then
      v_att_first := btrim(coalesce(v_attendees -> (i - 1) ->> 'first_name', ''));
      v_att_last := btrim(coalesce(v_attendees -> (i - 1) ->> 'last_name', ''));
    else
      v_att_first := '';
      v_att_last := '';
    end if;
    if v_att_first = '' and v_att_last = '' then
      if i = 1 then
        v_att_first := v_first; v_att_last := v_last;
      else
        v_att_first := 'Accompagnant·e ' || (i - 1); v_att_last := '(' || v_first || ' ' || v_last || ')';
      end if;
    end if;
    if length(v_att_first) > 80 or length(v_att_last) > 80 then
      perform private.raise_business_error('INVALID_INPUT', 'attendees');
    end if;

    v_attendee_id := gen_random_uuid();
    insert into public.reservation_attendees (id, reservation_id, position, first_name, last_name, qr_token_hash)
    values (v_attendee_id, v_res_id, i, v_att_first, v_att_last,
            private.token_hash(private.qr_token(v_attendee_id)));
  end loop;

  insert into public.payments (reservation_id, amount_due_cents, amount_paid_cents, status)
  values (v_res_id, v_total, 0, private.payment_status_for(v_total, 0));

  perform private.enqueue('reservation_confirmed', v_res_id);

  return private.reservation_json(v_res_id, true) || jsonb_build_object('replayed', false);
end;
$$;

create function public.get_reservations(p_access_tokens text[])
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(private.reservation_json(r.id, true) order by e.starts_at), '[]'::jsonb)
  from public.reservations r
  join public.events e on e.id = r.event_id
  where r.access_token_hash in (
    select private.token_hash(t) from unnest(p_access_tokens[1:50]) as t
  )
$$;

create function public.cancel_reservation(p_access_token text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_res public.reservations;
  v_event public.events;
begin
  select * into v_res from public.reservations
   where access_token_hash = private.token_hash(p_access_token)
   for update;
  if not found then
    perform private.raise_business_error('RESERVATION_NOT_FOUND');
  end if;

  if v_res.status = 'cancelled' then
    -- Annulation répétée : sans effet sur le compteur.
    return private.reservation_json(v_res.id, true) || jsonb_build_object('already_cancelled', true);
  end if;

  select * into v_event from public.events where id = v_res.event_id;
  if now() >= private.cancellation_deadline(v_event) then
    perform private.raise_business_error('CANCELLATION_CLOSED',
      private.cancellation_deadline(v_event)::text);
  end if;

  perform private.cancel_reservation_internal(v_res.id, 'participant');
  return private.reservation_json(v_res.id, true) || jsonb_build_object('already_cancelled', false);
end;
$$;

create function public.register_push_token(p_access_token text, p_push_token text, p_platform text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if p_push_token is null or length(p_push_token) not between 10 and 255
     or p_platform not in ('ios', 'android', 'web') then
    perform private.raise_business_error('INVALID_INPUT', 'push_token');
  end if;

  select contact_profile_id into v_profile_id
    from public.reservations where access_token_hash = private.token_hash(p_access_token);
  if not found then
    perform private.raise_business_error('RESERVATION_NOT_FOUND');
  end if;

  insert into public.device_tokens (profile_id, push_token, platform, permission_status)
  values (v_profile_id, p_push_token, p_platform, 'granted')
  on conflict (profile_id, push_token)
  do update set revoked_at = null, permission_status = 'granted', platform = excluded.platform;
end;
$$;

-- -----------------------------------------------------------------------------
-- API administrateur
-- -----------------------------------------------------------------------------
create function private.attendee_admin_json(p_attendee_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'attendee', jsonb_build_object('id', a.id, 'position', a.position, 'first_name', a.first_name,
      'last_name', a.last_name, 'attendance_status', a.attendance_status, 'checked_in_at', a.checked_in_at),
    'reservation', jsonb_build_object('id', r.id, 'status', r.status, 'participant_count', r.participant_count,
      'total_amount_cents', r.total_amount_cents,
      'contact', jsonb_build_object('first_name', p.first_name, 'last_name', p.last_name,
        'email', p.email, 'phone', p.phone)),
    'payment', jsonb_build_object('status', pay.status, 'amount_due_cents', pay.amount_due_cents,
      'amount_paid_cents', pay.amount_paid_cents, 'method', pay.method, 'paid_at', pay.paid_at),
    'event', jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at)
  )
  from public.reservation_attendees a
  join public.reservations r on r.id = a.reservation_id
  join public.profiles p on p.id = r.contact_profile_id
  join public.events e on e.id = r.event_id
  left join public.payments pay on pay.reservation_id = r.id
  where a.id = p_attendee_id
$$;

-- Lecture d'un QR code : vérifie le code, la sortie et le statut. Ne pointe pas.
create function public.admin_lookup_qr(p_qr_token text, p_event_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_attendee public.reservation_attendees;
  v_event_id uuid;
  v_result text;
begin
  perform private.require_admin();

  select a.* into v_attendee from public.reservation_attendees a
   where a.qr_token_hash = private.token_hash(btrim(p_qr_token));

  if not found then
    perform private.audit('qr.lookup_unknown', 'event', p_event_id, '{}'::jsonb);
    return jsonb_build_object('result', 'unknown');
  end if;

  select r.event_id into v_event_id from public.reservations r where r.id = v_attendee.reservation_id;

  v_result := case
    when v_event_id <> p_event_id then 'wrong_event'
    when v_attendee.attendance_status = 'cancelled' then 'cancelled'
    when v_attendee.attendance_status = 'present' then 'already_present'
    else 'valid'
  end;

  return jsonb_build_object('result', v_result) || private.attendee_admin_json(v_attendee.id);
end;
$$;

-- Pointage atomique : un participant ne peut être pointé qu'une seule fois.
create function public.admin_check_in(p_attendee_id uuid, p_event_id uuid, p_method text default 'qr')
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_updated uuid;
  v_status public.attendance_status;
  v_event_id uuid;
begin
  perform private.require_admin();

  select a.attendance_status, r.event_id into v_status, v_event_id
    from public.reservation_attendees a
    join public.reservations r on r.id = a.reservation_id
   where a.id = p_attendee_id;

  if not found then
    return jsonb_build_object('result', 'unknown');
  elsif v_event_id <> p_event_id then
    return jsonb_build_object('result', 'wrong_event') || private.attendee_admin_json(p_attendee_id);
  end if;

  update public.reservation_attendees
     set attendance_status = 'present', checked_in_at = now(), checked_in_by = auth.uid()
   where id = p_attendee_id and attendance_status = 'expected'
  returning id into v_updated;

  if v_updated is null then
    select attendance_status into v_status from public.reservation_attendees where id = p_attendee_id;
    return jsonb_build_object('result', case v_status when 'present' then 'already_present' else 'cancelled' end)
           || private.attendee_admin_json(p_attendee_id);
  end if;

  perform private.audit('attendee.check_in', 'reservation_attendee', p_attendee_id,
    jsonb_build_object('event_id', p_event_id, 'method', coalesce(p_method, 'qr')));
  return jsonb_build_object('result', 'checked_in') || private.attendee_admin_json(p_attendee_id);
end;
$$;

create function public.admin_undo_check_in(p_attendee_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.reservation_attendees
     set attendance_status = 'expected', checked_in_at = null, checked_in_by = null
   where id = p_attendee_id and attendance_status = 'present';
  if found then
    perform private.audit('attendee.undo_check_in', 'reservation_attendee', p_attendee_id);
  end if;
  return private.attendee_admin_json(p_attendee_id);
end;
$$;

create function public.admin_record_payment(p_reservation_id uuid, p_amount_paid_cents int, p_method public.payment_method default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_before public.payments;
  v_after public.payments;
begin
  perform private.require_admin();
  if p_amount_paid_cents is null or p_amount_paid_cents < 0 then
    perform private.raise_business_error('INVALID_INPUT', 'amount');
  end if;

  select * into v_before from public.payments where reservation_id = p_reservation_id for update;
  if not found then
    perform private.raise_business_error('RESERVATION_NOT_FOUND');
  end if;

  update public.payments
     set amount_paid_cents = p_amount_paid_cents,
         status = private.payment_status_for(amount_due_cents, p_amount_paid_cents),
         method = case when p_amount_paid_cents > 0 then coalesce(p_method, method) end,
         paid_at = case when p_amount_paid_cents > 0 then now() end,
         recorded_by = auth.uid(),
         updated_at = now()
   where reservation_id = p_reservation_id
  returning * into v_after;

  perform private.audit('payment.record', 'reservation', p_reservation_id,
    jsonb_build_object('before', jsonb_build_object('amount_paid_cents', v_before.amount_paid_cents, 'status', v_before.status),
                       'after', jsonb_build_object('amount_paid_cents', v_after.amount_paid_cents, 'status', v_after.status,
                                                   'method', v_after.method)));
  return to_jsonb(v_after);
end;
$$;

create function public.admin_cancel_reservation(p_reservation_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_done boolean;
begin
  perform private.require_admin();
  v_done := private.cancel_reservation_internal(p_reservation_id, 'admin');
  if v_done then
    perform private.audit('reservation.cancel', 'reservation', p_reservation_id);
  end if;
  return jsonb_build_object('cancelled', v_done);
end;
$$;

create function public.admin_event_stats(p_event_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object(
    'event_id', e.id,
    'capacity', e.capacity,
    'seats_taken', e.seats_taken,
    'seats_left', e.capacity - e.seats_taken,
    'reservations', (select count(*) from public.reservations r where r.event_id = e.id and r.status = 'confirmed'),
    'present', (select count(*) from public.reservation_attendees a join public.reservations r on r.id = a.reservation_id
                 where r.event_id = e.id and a.attendance_status = 'present'),
    'payments_received', (select count(*) from public.payments p join public.reservations r on r.id = p.reservation_id
                 where r.event_id = e.id and r.status = 'confirmed' and p.status = 'paid'),
    'amount_due_cents', (select coalesce(sum(p.amount_due_cents), 0) from public.payments p
                 join public.reservations r on r.id = p.reservation_id where r.event_id = e.id and r.status = 'confirmed'),
    'amount_paid_cents', (select coalesce(sum(p.amount_paid_cents), 0) from public.payments p
                 join public.reservations r on r.id = p.reservation_id where r.event_id = e.id)
  ) into v_result
  from public.events e where e.id = p_event_id;
  return v_result;
end;
$$;

-- Liste des participants (recherche + filtres) pour l'écran admin et la
-- saisie manuelle de secours.
create function public.admin_list_participants(p_event_id uuid, p_search text default null, p_filter text default 'all')
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_result jsonb;
begin
  perform private.require_admin();
  select coalesce(jsonb_agg(row order by row->>'sort_key'), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'sort_key', lower(a.last_name || ' ' || a.first_name),
      'attendee_id', a.id, 'first_name', a.first_name, 'last_name', a.last_name, 'position', a.position,
      'attendance_status', a.attendance_status, 'checked_in_at', a.checked_in_at,
      'reservation_id', r.id, 'reservation_status', r.status, 'participant_count', r.participant_count,
      'contact_name', p.first_name || ' ' || p.last_name, 'contact_phone', p.phone, 'contact_email', p.email,
      'payment_status', pay.status, 'amount_due_cents', pay.amount_due_cents, 'amount_paid_cents', pay.amount_paid_cents
    ) as row
    from public.reservation_attendees a
    join public.reservations r on r.id = a.reservation_id
    join public.profiles p on p.id = r.contact_profile_id
    left join public.payments pay on pay.reservation_id = r.id
    where r.event_id = p_event_id
      and (v_search is null
           or lower(a.first_name || ' ' || a.last_name) like '%' || v_search || '%'
           or lower(p.first_name || ' ' || p.last_name) like '%' || v_search || '%'
           or lower(p.email) like '%' || v_search || '%'
           or coalesce(p.phone, '') like '%' || v_search || '%')
      and case coalesce(p_filter, 'all')
            when 'confirmed' then r.status = 'confirmed'
            when 'present' then a.attendance_status = 'present'
            when 'absent' then a.attendance_status = 'expected'
            when 'paid' then r.status = 'confirmed' and pay.status = 'paid'
            when 'unpaid' then r.status = 'confirmed' and pay.status <> 'paid'
            when 'cancelled' then r.status = 'cancelled'
            else true
          end
  ) s;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- File de notifications (réservée au rôle service, utilisée par les Edge Functions)
-- -----------------------------------------------------------------------------
create function public.claim_notifications(p_limit int default 20)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_result jsonb;
begin
  -- Les messages restés « sending » plus de 10 min (crash) sont repris.
  update public.notification_outbox set status = 'pending'
   where status = 'sending' and created_at < now() - interval '10 minutes';

  with claimed as (
    select id from public.notification_outbox
     where status = 'pending'
     order by created_at
     limit greatest(1, least(coalesce(p_limit, 20), 100))
     for update skip locked
  ), upd as (
    update public.notification_outbox o
       set status = 'sending', attempts = attempts + 1
      from claimed c where o.id = c.id
    returning o.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', u.id, 'kind', u.kind, 'channel', u.channel, 'payload', u.payload,
      'reservation', private.reservation_json(u.reservation_id, true),
      'push_tokens', (select coalesce(jsonb_agg(d.push_token), '[]'::jsonb)
                        from public.device_tokens d
                        join public.reservations r on r.contact_profile_id = d.profile_id
                       where r.id = u.reservation_id and d.revoked_at is null),
      'settings', (select to_jsonb(s) - 'id' from public.app_settings s)
    )), '[]'::jsonb)
  into v_result
  from upd u;
  return v_result;
end;
$$;

create function public.complete_notification(p_id bigint, p_success boolean, p_error text default null,
  p_invalid_push_tokens text[] default '{}')
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  update public.notification_outbox
     set status = case when p_success then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
         sent_at = case when p_success then now() end,
         last_error = case when p_success then null else left(p_error, 1000) end
   where id = p_id;

  if coalesce(array_length(p_invalid_push_tokens, 1), 0) > 0 then
    update public.device_tokens set revoked_at = now(), permission_status = 'revoked'
     where push_token = any (p_invalid_push_tokens) and revoked_at is null;
  end if;
end;
$$;

-- Rappels configurables (par défaut J-1 et 3 h avant) : à appeler périodiquement
-- (pg_cron, voir supabase/cron.sql). Le rappel le plus éloigné part aussi par e-mail.
create function public.enqueue_reminders()
returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_offsets int[];
  v_max int;
  v_offset int;
  v_count int := 0;
  v_rec record;
begin
  select reminder_offsets_hours into v_offsets from public.app_settings;
  select max(x) into v_max from unnest(v_offsets) x;

  foreach v_offset in array coalesce(v_offsets, '{}') loop
    for v_rec in
      select r.id
        from public.reservations r
        join public.events e on e.id = r.event_id
       where r.status = 'confirmed'
         and e.status in ('published', 'closed')
         and e.starts_at > now()
         and e.starts_at <= now() + make_interval(hours => v_offset)
         and r.created_at < e.starts_at - make_interval(hours => v_offset)
    loop
      insert into public.notification_outbox (kind, channel, reservation_id, dedupe_key, payload)
      select 'reminder', 'push', v_rec.id, 'reminder:push:' || v_rec.id || ':' || v_offset,
             jsonb_build_object('offset_hours', v_offset)
       where exists (select 1 from public.device_tokens d join public.reservations r on r.contact_profile_id = d.profile_id
                      where r.id = v_rec.id and d.revoked_at is null)
      on conflict (dedupe_key) do nothing;

      if v_offset = v_max then
        insert into public.notification_outbox (kind, channel, reservation_id, dedupe_key, payload)
        values ('reminder', 'email', v_rec.id, 'reminder:email:' || v_rec.id || ':' || v_offset,
                jsonb_build_object('offset_hours', v_offset))
        on conflict (dedupe_key) do nothing;
      end if;
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- Protection des données (RGPD)
-- -----------------------------------------------------------------------------
create function private.anonymize_profile(p_profile_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles
     set first_name = 'Anonyme', last_name = 'Anonyme',
         email = 'anonyme+' || id || '@invalid.local', phone = null, anonymized_at = now()
   where id = p_profile_id and role = 'participant' and anonymized_at is null;
  update public.reservation_attendees a
     set first_name = 'Anonyme', last_name = 'Participant ' || a.position
    from public.reservations r
   where r.id = a.reservation_id and r.contact_profile_id = p_profile_id;
  delete from public.device_tokens where profile_id = p_profile_id;
end;
$$;

-- Anonymise les participants dont toutes les sorties sont terminées depuis
-- plus que la durée de conservation définie dans app_settings.
create function private.anonymize_expired_data()
returns int language plpgsql security definer set search_path = ''
as $$
declare
  v_months int;
  v_id uuid;
  v_count int := 0;
begin
  select data_retention_months into v_months from public.app_settings;
  for v_id in
    select p.id from public.profiles p
     where p.role = 'participant' and p.anonymized_at is null
       and not exists (
         select 1 from public.reservations r join public.events e on e.id = r.event_id
          where r.contact_profile_id = p.id
            and coalesce(e.ends_at, e.starts_at) > now() - make_interval(months => v_months))
  loop
    perform private.anonymize_profile(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Droit à l'effacement traité par l'organisateur.
create function public.admin_anonymize_reservation_contact(p_reservation_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_profile uuid;
begin
  perform private.require_admin();
  select contact_profile_id into v_profile from public.reservations where id = p_reservation_id;
  if v_profile is null then
    perform private.raise_business_error('RESERVATION_NOT_FOUND');
  end if;
  perform private.cancel_reservation_internal(p_reservation_id, 'admin');
  perform private.anonymize_profile(v_profile);
  perform private.audit('profile.anonymize', 'profile', v_profile, jsonb_build_object('reservation_id', p_reservation_id));
end;
$$;

-- Nommer un administrateur : uniquement depuis l'éditeur SQL (schéma privé).
-- Aucun rôle administrateur ne peut être attribué depuis l'application.
create function private.grant_admin(p_email text, p_first_name text, p_last_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_profile uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    raise exception 'Aucun utilisateur Auth avec l''e-mail %. Créez-le d''abord dans Supabase Auth.', p_email;
  end if;
  insert into public.profiles (user_id, first_name, last_name, email, role)
  values (v_user, p_first_name, p_last_name, lower(p_email), 'admin')
  on conflict (user_id) do update set role = 'admin'
  returning id into v_profile;
  return v_profile;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.app_settings enable row level security;
alter table public.events enable row level security;
alter table public.profiles enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_attendees enable row level security;
alter table public.payments enable row level security;
alter table public.device_tokens enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Sorties : le public ne voit que les sorties publiées (y compris complètes,
-- annulées ou passées) ; les brouillons sont réservés aux administrateurs.
create policy events_public_read on public.events for select
  to anon, authenticated using (status <> 'draft' or public.is_admin());
create policy events_admin_insert on public.events for insert
  to authenticated with check (public.is_admin());
create policy events_admin_update on public.events for update
  to authenticated using (public.is_admin()) with check (public.is_admin());

create policy settings_public_read on public.app_settings for select to anon, authenticated using (true);
create policy settings_admin_update on public.app_settings for update
  to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_admin_read on public.profiles for select
  to authenticated using (public.is_admin() or user_id = auth.uid());
create policy reservations_admin_read on public.reservations for select
  to authenticated using (public.is_admin());
create policy attendees_admin_read on public.reservation_attendees for select
  to authenticated using (public.is_admin());
create policy payments_admin_read on public.payments for select
  to authenticated using (public.is_admin());
create policy audit_admin_read on public.admin_audit_logs for select
  to authenticated using (public.is_admin());
-- device_tokens et notification_outbox : aucune politique => aucun accès client.

-- -----------------------------------------------------------------------------
-- Droits (Supabase accorde par défaut tous les droits à anon/authenticated :
-- on les retire puis on accorde le strict nécessaire).
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

grant select on public.events to anon, authenticated;
grant insert (title, summary, description, starts_at, ends_at, meeting_point, meeting_point_url,
  distance_km, elevation_m, difficulty, price_cents, capacity, equipment, instructions,
  cover_image, cancellation_deadline_hours, status) on public.events to authenticated;
grant update (title, summary, description, starts_at, ends_at, meeting_point, meeting_point_url,
  distance_km, elevation_m, difficulty, price_cents, capacity, equipment, instructions,
  cover_image, cancellation_deadline_hours, status) on public.events to authenticated;

grant select on public.app_settings to anon, authenticated;
grant update (organizer_name, organizer_email, organizer_phone, default_capacity,
  default_cancellation_deadline_hours, max_participants_per_reservation, reminder_offsets_hours,
  data_retention_months) on public.app_settings to authenticated;

grant select on public.profiles, public.reservations, public.reservation_attendees,
  public.payments, public.admin_audit_logs to authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.create_reservation(uuid, uuid, text, text, text, text, int, jsonb, boolean, boolean) to anon, authenticated;
grant execute on function public.get_reservations(text[]) to anon, authenticated;
grant execute on function public.cancel_reservation(text) to anon, authenticated;
grant execute on function public.register_push_token(text, text, text) to anon, authenticated;

grant execute on function public.admin_lookup_qr(text, uuid) to authenticated;
grant execute on function public.admin_check_in(uuid, uuid, text) to authenticated;
grant execute on function public.admin_undo_check_in(uuid) to authenticated;
grant execute on function public.admin_record_payment(uuid, int, public.payment_method) to authenticated;
grant execute on function public.admin_cancel_reservation(uuid) to authenticated;
grant execute on function public.admin_event_stats(uuid) to authenticated;
grant execute on function public.admin_list_participants(uuid, text, text) to authenticated;
grant execute on function public.admin_anonymize_reservation_contact(uuid) to authenticated;

grant execute on function public.claim_notifications(int) to service_role;
grant execute on function public.complete_notification(bigint, boolean, text, text[]) to service_role;
grant execute on function public.enqueue_reminders() to service_role;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
