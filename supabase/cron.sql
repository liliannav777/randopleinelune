-- Planification (à exécuter une fois dans l'éditeur SQL du projet Supabase,
-- après avoir activé les extensions pg_cron et pg_net).
-- Remplacer <PROJECT_REF> et <NOTIFICATIONS_CRON_SECRET>.

-- Secret partagé avec l'Edge Function, stocké dans Vault.
select vault.create_secret('<NOTIFICATIONS_CRON_SECRET>', 'notifications_cron_secret');

-- Envoi des notifications et rappels : toutes les 2 minutes.
select cron.schedule('process-notifications', '*/2 * * * *', $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                      where name = 'notifications_cron_secret')),
    body := '{}'::jsonb)
$$);

-- Anonymisation des données au-delà de la durée de conservation : chaque nuit.
select cron.schedule('anonymize-expired-data', '17 3 * * *', $$ select private.anonymize_expired_data() $$);

-- Purge des notifications envoyées depuis plus de 90 jours.
select cron.schedule('purge-notifications', '27 3 * * *', $$
  delete from public.notification_outbox where status in ('sent', 'skipped') and created_at < now() - interval '90 days'
$$);
