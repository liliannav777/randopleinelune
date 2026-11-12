#!/usr/bin/env bash
# Teste les migrations et les règles métier sur un PostgreSQL local (≥ 15).
# La connexion utilise les variables libpq habituelles (PGHOST, PGPORT, PGUSER…).
#   PGHOST=localhost PGUSER=postgres ./supabase/tests/run.sh
# La base « rpl_test » est recréée à chaque exécution.
set -euo pipefail
cd "$(dirname "$0")/.."
export PGUSER="${PGUSER:-postgres}"
ADMIN_URL="postgres"
DB_URL="rpl_test"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" "$ADMIN_URL" -c 'drop database if exists rpl_test with (force)' -c 'create database rpl_test'
"${PSQL[@]}" "$DB_URL" -f tests/supabase_stub.sql
for f in migrations/*.sql; do "${PSQL[@]}" "$DB_URL" -f "$f"; done
"${PSQL[@]}" "$DB_URL" -f seed.sql

echo "== Règles métier"
"${PSQL[@]}" "$DB_URL" -o /dev/null -f tests/test_rules.sql 2>&1 | sed 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /'
[[ ${PIPESTATUS[0]} == 0 ]] || exit 1

echo "== Concurrence : 40 réservations simultanées d'une place pour 30 places"
EVENT=$("${PSQL[@]}" -tA "$DB_URL" -c "insert into public.events (title, starts_at, meeting_point, capacity, status)
  values ('Test concurrence', now() + interval '10 days', 'Test', 30, 'published') returning id")
pids=()
for i in $(seq 1 40); do
  "${PSQL[@]}" -tA "$DB_URL" -c "set role anon; select public.create_reservation('$EVENT', gen_random_uuid(),
    'P', 'N$i', 'p$i@example.org', '0600000000', 1, '[]', true, true)->>'status'" >/dev/null 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p" || true; done
read -r TAKEN COUNT <<<"$("${PSQL[@]}" -tA -F ' ' "$DB_URL" -c "select e.seats_taken,
  (select count(*) from public.reservations r where r.event_id = e.id and r.status = 'confirmed')
  from public.events e where e.id = '$EVENT'")"
[[ "$TAKEN" == 30 && "$COUNT" == 30 ]] || { echo "ÉCHEC : $COUNT réservations / $TAKEN places"; exit 1; }
echo "  ok - exactement 30 réservations acceptées, compteur = 30"

echo "== Concurrence : dernière place disputée par 10 requêtes"
EVENT2=$("${PSQL[@]}" -tA "$DB_URL" -c "insert into public.events (title, starts_at, meeting_point, capacity, status)
  values ('Dernière place', now() + interval '10 days', 'Test', 1, 'published') returning id")
pids=()
for i in $(seq 1 10); do
  "${PSQL[@]}" -tA "$DB_URL" -c "set role anon; select public.create_reservation('$EVENT2', gen_random_uuid(),
    'P', 'N$i', 'q$i@example.org', '0600000000', 1, '[]', true, true)" >/dev/null 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p" || true; done
N=$("${PSQL[@]}" -tA "$DB_URL" -c "select count(*) from public.reservations where event_id = '$EVENT2'")
[[ "$N" == 1 ]] || { echo "ÉCHEC : $N réservations pour la dernière place"; exit 1; }
echo "  ok - une seule réservation acceptée"

echo "== Concurrence : même clé d'idempotence envoyée 10 fois en parallèle"
EVENT3=$("${PSQL[@]}" -tA "$DB_URL" -c "insert into public.events (title, starts_at, meeting_point, capacity, status)
  values ('Double clic', now() + interval '10 days', 'Test', 30, 'published') returning id")
KEY=$(cat /proc/sys/kernel/random/uuid)
pids=()
for i in $(seq 1 10); do
  "${PSQL[@]}" -tA "$DB_URL" -c "set role anon; select public.create_reservation('$EVENT3', '$KEY',
    'P', 'N', 'dup@example.org', '0600000000', 2, '[]', true, true)" >/dev/null 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p" || true; done
read -r TAKEN COUNT <<<"$("${PSQL[@]}" -tA -F ' ' "$DB_URL" -c "select e.seats_taken,
  (select count(*) from public.reservations r where r.event_id = e.id) from public.events e where e.id = '$EVENT3'")"
[[ "$TAKEN" == 2 && "$COUNT" == 1 ]] || { echo "ÉCHEC : $COUNT réservations / $TAKEN places"; exit 1; }
echo "  ok - une seule réservation, 2 places décomptées"

echo "Tous les tests sont passés."
