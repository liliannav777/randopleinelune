-- Tests des règles métier (Spécifications V1 §7 et plan de tests §11).
-- Exécuté par supabase/tests/run.sh sur une base fraîche (migrations + seed).
\set ON_ERROR_STOP 1
\set QUIET 1

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create function tests.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'ÉCHEC : %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;

-- Exécute une requête et vérifie qu'elle échoue avec le message (code métier)
-- ou le SQLSTATE attendu.
create function tests.throws(p_sql text, p_expected text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_expected or sqlstate = p_expected then
      raise notice 'ok - %', p_msg; return;
    end if;
    raise exception 'ÉCHEC : % (erreur inattendue : % / %)', p_msg, sqlstate, sqlerrm;
  end;
  raise exception 'ÉCHEC : % (aucune erreur levée)', p_msg;
end $$;

create function tests.book(p_event uuid, p_email text, p_count int, p_key uuid default gen_random_uuid())
returns jsonb language sql as $$
  select public.create_reservation(p_event, p_key, 'Camille', 'Martin', p_email, '06 12 34 56 78', p_count,
                                   '[]'::jsonb, true, true)
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Contexte : une petite sortie de 5 places, une autre sortie, un admin.
create table tests.ctx as
select
  (select id from public.events where status = 'published' order by starts_at limit 1) as ev,
  (select id from public.events where status = 'published' order by starts_at offset 1 limit 1) as ev2,
  (select id from public.events where status = 'draft' limit 1) as draft;
grant select on tests.ctx to anon, authenticated, service_role;
update public.events set capacity = 5 where id = (select ev from tests.ctx);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a001', 'orga@example.org'),
  ('00000000-0000-0000-0000-00000000b002', 'curieux@example.org');
select private.grant_admin('orga@example.org', 'Orga', 'Nisateur');

-- ---------------------------------------------------------------------------
-- Participant anonyme
-- ---------------------------------------------------------------------------
set role anon;

select tests.ok((select count(*) from public.events where id = (select draft from tests.ctx)) = 0,
  'un brouillon n''est pas visible du public');
select tests.throws('select * from public.reservations', '42501', 'le public ne lit pas les réservations');
select tests.throws('select * from public.profiles', '42501', 'le public ne lit pas les profils');
select tests.throws($$update public.events set price_cents = 0$$, '42501', 'le public ne modifie pas les sorties');
select tests.throws($$select tests.book((select draft from tests.ctx), 'a@example.org', 1)$$,
  'EVENT_NOT_FOUND', 'réservation impossible sur un brouillon');
select tests.throws($$select public.create_reservation((select ev from tests.ctx), gen_random_uuid(), 'A', 'B',
  'a@example.org', '0612345678', 1, '[]', false, true)$$, 'CONSENT_REQUIRED', 'conditions obligatoires');
select tests.throws($$select tests.book((select ev from tests.ctx), 'pas-un-email', 1)$$,
  'INVALID_INPUT', 'e-mail invalide refusé');
select tests.throws($$select tests.book((select ev from tests.ctx), 'a@example.org', 0)$$,
  'INVALID_INPUT', 'nombre de participants invalide refusé');

-- 1. Réservation avec places disponibles
create temp table r1 as select tests.book((select ev from tests.ctx), 'alice@example.org', 2,
  '11111111-1111-1111-1111-111111111111') as j;
select tests.ok((select j->>'status' from r1) = 'confirmed', 'réservation confirmée');
select tests.ok((select (j->>'total_amount_cents')::int from r1) = 4000, 'montant = tarif × participants');
select tests.ok((select jsonb_array_length(j->'attendees') from r1) = 2, 'un participant par place');
select tests.ok((select count(distinct a->>'qr_token') from r1, jsonb_array_elements(j->'attendees') a) = 2,
  'un QR code distinct par participant');
select tests.ok((select (j->'attendees'->0->>'qr_token') like 'RPL1.%' from r1), 'QR code opaque préfixé');
select tests.ok((select position('alice' in j->'attendees'->0->>'qr_token') = 0 from r1),
  'le QR code ne contient pas de données personnelles');
select tests.ok((select seats_taken from public.events where id = (select ev from tests.ctx)) = 2, 'places décomptées');

-- 5. Double clic / requête rejouée
create temp table r1bis as select tests.book((select ev from tests.ctx), 'alice@example.org', 2,
  '11111111-1111-1111-1111-111111111111') as j;
select tests.ok((select j->>'id' from r1bis) = (select j->>'id' from r1)
                and (select (j->>'replayed')::boolean from r1bis), 'même clé = même réservation');
select tests.ok((select seats_taken from public.events where id = (select ev from tests.ctx)) = 2,
  'pas de double décompte');
select tests.throws($$select tests.book((select ev from tests.ctx), 'alice@example.org', 1)$$,
  'ALREADY_BOOKED', 'pas de seconde réservation pour le même e-mail');

-- 3. Réservation au-delà de la capacité (3 places restantes)
select tests.throws($$select tests.book((select ev from tests.ctx), 'bob@example.org', 4)$$,
  'EVENT_FULL', 'réservation au-delà de la capacité refusée');
select tests.ok((select seats_taken from public.events where id = (select ev from tests.ctx)) = 2,
  'aucune réservation partielle');

-- 2. Réservation exactement à la capacité restante
create temp table r2 as select tests.book((select ev from tests.ctx), 'bob@example.org', 3) as j;
select tests.ok((select seats_taken = capacity from public.events where id = (select ev from tests.ctx)),
  'capacité atteinte exactement');
select tests.throws($$select tests.book((select ev from tests.ctx), 'carol@example.org', 1)$$,
  'EVENT_FULL', 'sortie complète');

-- Espace personnel
select tests.ok(jsonb_array_length(public.get_reservations(array[(select j->>'access_token' from r1), 'faux'])) = 1,
  'un jeton d''accès ne donne que sa propre réservation');

-- 6. Annulation
create temp table c1 as select public.cancel_reservation((select j->>'access_token' from r2)) as j;
select tests.ok((select j->>'status' from c1) = 'cancelled', 'annulation acceptée');
select tests.ok((select seats_taken from public.events where id = (select ev from tests.ctx)) = 2, 'places libérées');
create temp table c2 as select public.cancel_reservation((select j->>'access_token' from r2)) as j;
select tests.ok((select (j->>'already_cancelled')::boolean from c2)
  and (select seats_taken from public.events where id = (select ev from tests.ctx)) = 2,
  'double annulation sans effet sur le compteur');
select tests.ok((select j->'attendees'->0->>'qr_token' is null from c2), 'QR code retiré après annulation');
select tests.throws($$select public.cancel_reservation('inconnu')$$, 'RESERVATION_NOT_FOUND', 'jeton inconnu refusé');

-- Admin interdit au public
select tests.throws($$select public.admin_lookup_qr('x', (select ev from tests.ctx))$$, '42501',
  'le public ne peut pas appeler le scanner');
grant select on r1, r1bis, r2, c1, c2 to public;
reset role;

-- ---------------------------------------------------------------------------
-- Utilisateur authentifié non administrateur
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000b002', false);
select tests.throws($$select public.admin_lookup_qr('x', (select ev from tests.ctx))$$, 'FORBIDDEN',
  'scan refusé à un non-administrateur');
select tests.throws($$select public.admin_record_payment((select (j->>'id')::uuid from r1), 4000)$$, 'FORBIDDEN',
  'paiement refusé à un non-administrateur');
select tests.ok((select count(*) from public.reservations) = 0, 'un non-admin ne voit aucune réservation (RLS)');
select tests.throws($$insert into public.profiles (user_id, first_name, last_name, email, role)
  values (auth.uid(), 'X', 'Y', 'x@y.z', 'admin')$$, '42501', 'impossible de s''attribuer le rôle admin');
select tests.throws($$insert into public.events (title, starts_at, meeting_point) values ('Pirate', now() + interval '1 day', 'X')$$,
  '42501', 'un non-admin ne crée pas de sortie');
reset role;

-- ---------------------------------------------------------------------------
-- Administrateur
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', false);
select tests.ok(public.is_admin(), 'l''organisateur est administrateur');
select tests.ok((select count(*) from public.events where id = (select draft from tests.ctx)) = 1,
  'l''admin voit les brouillons');

-- 7. QR valide
create temp table q1 as select public.admin_lookup_qr((select j->'attendees'->0->>'qr_token' from r1),
  (select ev from tests.ctx)) as j;
select tests.ok((select j->>'result' from q1) = 'valid', 'QR valide reconnu');
select tests.ok((select j->'attendee'->>'first_name' from q1) = 'Camille', 'participant identifié');
create temp table k1 as select public.admin_check_in((select (j->'attendee'->>'id')::uuid from q1),
  (select ev from tests.ctx)) as j;
select tests.ok((select j->>'result' from k1) = 'checked_in', 'pointage enregistré');
select tests.ok((select checked_in_by from public.reservation_attendees
                  where id = (select (j->'attendee'->>'id')::uuid from q1)) = auth.uid(),
  'identité de l''admin enregistrée');

-- 8. QR déjà utilisé
select tests.ok((public.admin_lookup_qr((select j->'attendees'->0->>'qr_token' from r1), (select ev from tests.ctx))->>'result')
  = 'already_present', 'QR déjà pointé signalé');
select tests.ok((public.admin_check_in((select (j->'attendee'->>'id')::uuid from q1), (select ev from tests.ctx))->>'result')
  = 'already_present', 'pas de second pointage silencieux');

-- 9. QR inconnu, annulé, autre sortie
select tests.ok((public.admin_lookup_qr('RPL1.inconnu', (select ev from tests.ctx))->>'result') = 'unknown', 'QR inconnu refusé');
select tests.ok((public.admin_lookup_qr((select j->'attendees'->0->>'qr_token' from r2), (select ev from tests.ctx))->>'result')
  = 'cancelled', 'QR annulé refusé');
select tests.ok((public.admin_lookup_qr((select j->'attendees'->1->>'qr_token' from r1), (select ev2 from tests.ctx))->>'result')
  = 'wrong_event', 'QR d''une autre sortie refusé');

-- 12. Paiement sur place
select public.admin_record_payment((select (j->>'id')::uuid from r1), 2000, 'cash');
select tests.ok((select status from public.payments where reservation_id = (select (j->>'id')::uuid from r1)) = 'partial',
  'paiement partiel');
select public.admin_record_payment((select (j->>'id')::uuid from r1), 4000, 'card');
select tests.ok((select status = 'paid' and method = 'card' and recorded_by = auth.uid() from public.payments
  where reservation_id = (select (j->>'id')::uuid from r1)), 'paiement complet tracé');
select tests.ok((select count(*) from public.admin_audit_logs where action = 'payment.record') = 2, 'paiements journalisés');
select tests.ok((select count(*) from public.admin_audit_logs where action = 'attendee.check_in') = 1, 'pointage journalisé');

-- Statistiques et liste
select tests.ok((public.admin_event_stats((select ev from tests.ctx))->>'present')::int = 1
  and (public.admin_event_stats((select ev from tests.ctx))->>'payments_received')::int = 1, 'tableau de bord cohérent');
select tests.ok(jsonb_array_length(public.admin_list_participants((select ev from tests.ctx), 'camille', 'present')) = 1,
  'recherche + filtre participants');

-- Capacité non réductible sous le nombre de places prises
select tests.throws($$update public.events set capacity = 1 where id = (select ev from tests.ctx)$$, '23514',
  'capacité inférieure aux réservations refusée');
-- Le compteur de places ne peut pas être modifié directement
select tests.throws($$update public.events set seats_taken = 0 where id = (select ev from tests.ctx)$$, '42501',
  'compteur de places protégé');
reset role;

-- ---------------------------------------------------------------------------
-- Délai d'annulation, sortie annulée, notifications
-- ---------------------------------------------------------------------------
set role anon;
create temp table r3 as select tests.book((select ev2 from tests.ctx), 'dan@example.org', 1) as j;
reset role;
update public.events set starts_at = now() + interval '2 hours' where id = (select ev2 from tests.ctx);
update public.reservations set created_at = now() - interval '3 days' where id = (select (j->>'id')::uuid from r3);
set role anon;
select tests.throws($$select public.cancel_reservation((select j->>'access_token' from r3))$$, 'CANCELLATION_CLOSED',
  'annulation refusée après l''échéance');
reset role;

select tests.ok(public.enqueue_reminders() >= 1, 'rappel programmé avant la sortie');
select tests.ok((select count(*) from public.notification_outbox where kind = 'reminder' and channel = 'email') = 1,
  'rappel e-mail mis en file');
select tests.ok((select count(*) from public.notification_outbox where kind = 'reminder' and channel = 'push') = 0,
  'pas de push sans appareil autorisé (11. push refusée)');
select tests.ok((select count(*) from public.notification_outbox
                  where kind = 'reservation_confirmed' and channel = 'email') = 3,
  'e-mail de confirmation pour chaque réservation');

set role anon;
select public.register_push_token((select j->>'access_token' from r3), 'ExponentPushToken[test-123]', 'ios');
reset role;
select public.enqueue_reminders();
select tests.ok((select count(*) from public.notification_outbox where kind = 'reminder' and channel = 'push') >= 1,
  'rappel push après autorisation');

update public.events set status = 'cancelled' where id = (select ev2 from tests.ctx);
select tests.ok((select status from public.reservations where id = (select (j->>'id')::uuid from r3)) = 'cancelled'
  and (select seats_taken from public.events where id = (select ev2 from tests.ctx)) = 0,
  'sortie annulée => réservations annulées');
select tests.ok((select count(*) from public.notification_outbox where kind = 'event_cancelled') = 2,
  'participants prévenus de l''annulation (e-mail + push)');

-- File de notifications (rôle service)
set role service_role;
create temp table claimed as select public.claim_notifications(100) as j;
select tests.ok(jsonb_array_length((select j from claimed)) > 0, 'notifications réclamées');
select tests.ok((select bool_and(x->'reservation'->>'id' is not null and x->'settings'->>'organizer_name' is not null)
  from claimed, jsonb_array_elements(j) x), 'contenu de notification complet');
select public.complete_notification(((select j->0->>'id' from claimed))::bigint, true);
reset role;
select tests.ok((select status from public.notification_outbox where id = (select (j->0->>'id')::bigint from claimed)) = 'sent',
  'notification marquée envoyée');
set role anon;
select tests.throws('select public.claim_notifications(10)', '42501', 'la file est inaccessible au public');
reset role;

-- RGPD : anonymisation après la durée de conservation
update public.events set starts_at = now() - interval '30 months', ends_at = now() - interval '30 months' + interval '4 hours'
 where id = (select ev2 from tests.ctx);
select tests.ok(private.anonymize_expired_data() = 1, 'anonymisation des données expirées');
select tests.ok((select email like 'anonyme+%' and phone is null from public.profiles p
  join public.reservations r on r.contact_profile_id = p.id where r.id = (select (j->>'id')::uuid from r3)),
  'coordonnées effacées');

\echo 'Tous les tests de règles sont passés.'
