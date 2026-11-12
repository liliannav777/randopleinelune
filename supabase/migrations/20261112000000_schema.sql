-- =============================================================================
-- Rando Pleine Lune Lyon Beaujolais — schéma initial (MVP)
-- Spécifications V1, §6 (modèle de données) et §7 (règles métier et sécurité)
--
-- Principes :
--  * Toutes les écritures sensibles (réservation, annulation, pointage,
--    paiement) passent par des fonctions SECURITY DEFINER : jamais par des
--    écritures directes depuis l'application.
--  * RLS activé sur toutes les tables exposées.
--  * Les jetons (QR, lien d'accès) ne sont jamais stockés en clair : on stocke
--    une empreinte SHA-256. Les jetons sont dérivés par HMAC d'une clé serveur
--    pour pouvoir être régénérés (e-mail, lien de récupération).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.event_status as enum ('draft', 'published', 'closed', 'cancelled', 'completed');
create type public.reservation_status as enum ('confirmed', 'cancelled');
create type public.attendance_status as enum ('expected', 'present', 'cancelled');
create type public.payment_status as enum ('unpaid', 'partial', 'paid');
create type public.payment_method as enum ('cash', 'card', 'transfer', 'other');
create type public.profile_role as enum ('participant', 'admin');

-- -----------------------------------------------------------------------------
-- Secrets serveur (schéma privé, jamais exposé par l'API)
-- -----------------------------------------------------------------------------
create table private.app_secrets (
  id boolean primary key default true check (id),
  token_hmac_key bytea not null default extensions.gen_random_bytes(32)
);
insert into private.app_secrets default values;

-- -----------------------------------------------------------------------------
-- Paramètres organisateur (singleton)
-- -----------------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  organizer_name text not null default 'Rando Pleine Lune Lyon Beaujolais',
  organizer_email text,
  organizer_phone text,
  default_capacity int not null default 30 check (default_capacity > 0),
  default_cancellation_deadline_hours int not null default 24 check (default_cancellation_deadline_hours >= 0),
  max_participants_per_reservation int not null default 10 check (max_participants_per_reservation between 1 and 50),
  reminder_offsets_hours int[] not null default '{24,3}',
  data_retention_months int not null default 24 check (data_retention_months >= 1),
  updated_at timestamptz not null default now()
);
insert into public.app_settings default values;

-- -----------------------------------------------------------------------------
-- Randonnées
-- -----------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 3 and 140),
  summary text,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  meeting_point text not null,
  meeting_point_url text,
  distance_km numeric(5, 1) check (distance_km >= 0),
  elevation_m int check (elevation_m >= 0),
  difficulty text check (difficulty in ('facile', 'moyenne', 'soutenue', 'difficile')),
  price_cents int not null default 0 check (price_cents >= 0),
  capacity int not null default 30 check (capacity > 0),
  seats_taken int not null default 0,
  equipment text,
  instructions text,
  cover_image text,
  cancellation_deadline_hours int,
  status public.event_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_seats_within_capacity check (seats_taken >= 0 and seats_taken <= capacity),
  constraint events_ends_after_start check (ends_at is null or ends_at > starts_at)
);
create index events_starts_at_idx on public.events (starts_at);
create index events_status_idx on public.events (status);

-- -----------------------------------------------------------------------------
-- Profils (contacts participants et administrateurs)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  role public.profile_role not null default 'participant',
  anonymized_at timestamptz,
  created_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));

-- -----------------------------------------------------------------------------
-- Réservations
-- -----------------------------------------------------------------------------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  contact_profile_id uuid not null references public.profiles (id) on delete restrict,
  participant_count int not null check (participant_count >= 1),
  status public.reservation_status not null default 'confirmed',
  total_amount_cents int not null check (total_amount_cents >= 0),
  idempotency_key uuid not null unique,
  access_token_hash bytea not null unique,
  terms_accepted_at timestamptz not null,
  privacy_accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('participant', 'admin', 'event_cancelled'))
);
create index reservations_event_idx on public.reservations (event_id, status);
create index reservations_contact_idx on public.reservations (contact_profile_id);

create table public.reservation_attendees (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  position smallint not null check (position >= 1),
  first_name text not null,
  last_name text not null,
  qr_token_hash bytea not null unique,
  attendance_status public.attendance_status not null default 'expected',
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users (id) on delete set null,
  unique (reservation_id, position)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations (id) on delete cascade,
  amount_due_cents int not null check (amount_due_cents >= 0),
  amount_paid_cents int not null default 0 check (amount_paid_cents >= 0),
  status public.payment_status not null default 'unpaid',
  method public.payment_method,
  paid_at timestamptz,
  recorded_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Notifications push : jetons d'appareils
-- -----------------------------------------------------------------------------
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  permission_status text not null default 'granted',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (profile_id, push_token)
);

-- -----------------------------------------------------------------------------
-- File d'envoi des notifications (outbox transactionnelle)
-- Les messages sont créés dans la même transaction que la réservation : un
-- e-mail n'est donc envoyé qu'après validation définitive côté serveur.
-- -----------------------------------------------------------------------------
create table public.notification_outbox (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('reservation_confirmed', 'reservation_cancelled', 'event_cancelled', 'reminder')),
  channel text not null check (channel in ('email', 'push')),
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  dedupe_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notification_outbox_pending_idx on public.notification_outbox (status, created_at) where status in ('pending', 'sending');

-- -----------------------------------------------------------------------------
-- Journal d'audit des actions administrateur
-- -----------------------------------------------------------------------------
create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_entity_idx on public.admin_audit_logs (entity_type, entity_id);
