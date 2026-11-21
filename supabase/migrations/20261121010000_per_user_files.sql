-- Per-user files: make the "documents" and "backgrounds" storage buckets
-- private, and let each account read and change only its own files.
--
-- Ownership: Supabase Storage records who uploaded each file in
-- storage.objects.owner_id. New uploads also go into a folder named after the
-- user's id ("<user id>/<file>"). A file counts as yours if either is true, so
-- existing files (uploaded at the bucket root) stay accessible to their uploader.
--
-- The app now reads these files through short-lived signed URLs instead of
-- public URLs (see src/services/storageService.js).
--
-- Safety: stops without changing anything unless there is exactly one user in
-- auth.users. Runs in one transaction.

begin;

do $$
declare
  v_owner uuid;
  user_count int;
  pol record;
begin
  select count(*) into user_count from auth.users;
  if user_count <> 1 then
    raise exception
      'Expected exactly 1 user in auth.users (the current owner) but found %. '
      'Set v_owner by hand in this script before running it.', user_count;
  end if;
  select id into v_owner from auth.users;

  -- Existing files with no recorded owner (for example, uploaded from the
  -- dashboard) belong to the current owner.
  update storage.objects
     set owner_id = v_owner::text
   where bucket_id in ('documents', 'backgrounds')
     and owner_id is null;

  -- Private buckets: no more public URLs.
  update storage.buckets
     set public = false
   where id in ('documents', 'backgrounds');

  -- Remove existing storage policies that mention these buckets.
  -- Policies that don't name a bucket are left alone. Check them with the
  -- verification query in the PR.
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ~ '(documents|backgrounds)'
           or coalesce(with_check, '') ~ '(documents|backgrounds)')
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy "Users read their own files"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('documents', 'backgrounds')
    and (owner_id = (select auth.uid())::text
         or (storage.foldername(name))[1] = (select auth.uid())::text)
  );

create policy "Users upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('documents', 'backgrounds')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users update their own files"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('documents', 'backgrounds')
    and (owner_id = (select auth.uid())::text
         or (storage.foldername(name))[1] = (select auth.uid())::text)
  );

create policy "Users delete their own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('documents', 'backgrounds')
    and (owner_id = (select auth.uid())::text
         or (storage.foldername(name))[1] = (select auth.uid())::text)
  );

commit;
