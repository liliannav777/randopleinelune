-- Photos des randonnées (Supabase Storage) : lecture publique, écriture admin.
-- Ignoré si le schéma storage n'existe pas (base de test PostgreSQL simple).
do $migration$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage absent : migration ignorée';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('event-photos', 'event-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  execute $p$create policy event_photos_admin_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'event-photos' and public.is_admin())$p$;
  execute $p$create policy event_photos_admin_update on storage.objects for update to authenticated
    using (bucket_id = 'event-photos' and public.is_admin())$p$;
  execute $p$create policy event_photos_admin_delete on storage.objects for delete to authenticated
    using (bucket_id = 'event-photos' and public.is_admin())$p$;
end
$migration$;
