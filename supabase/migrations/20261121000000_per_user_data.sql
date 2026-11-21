-- Per-user data: each row belongs to one account, and each account can only
-- read and change its own rows.
--
-- What this does, for every table that holds user data:
--   1. Adds a user_id column (if missing) that references auth.users.
--   2. Assigns every existing row to the current owner (the only user today).
--   3. Makes user_id default to the signed-in user, so the app doesn't have to
--      send it on insert, and makes it required.
--   4. Turns on Row Level Security, removes the existing policies on the table,
--      and adds one policy: signed-in users can only see and change their own rows.
--
-- Safety: the script stops without changing anything unless there is exactly one
-- user in auth.users, so existing data can't be assigned to the wrong person.
-- It runs in one transaction, so it either applies fully or not at all.

begin;

do $$
declare
  owner_id uuid;
  user_count int;
  t text;
  pol record;
  user_tables text[] := array[
    'applications', 'companies', 'contacts', 'documents', 'events',
    'focus_videos', 'goals', 'job_sites', 'positions',
    'notes', 'settings'          -- these two already have user_id
  ];
begin
  select count(*) into user_count from auth.users;
  if user_count <> 1 then
    raise exception
      'Expected exactly 1 user in auth.users (the current owner) but found %. '
      'Set owner_id by hand in this script before running it.', user_count;
  end if;
  select id into owner_id from auth.users;

  foreach t in array user_tables loop
    -- 1. Owner column
    execute format(
      'alter table public.%I add column if not exists user_id uuid '
      'references auth.users(id) on delete cascade', t);

    -- 2. Existing rows belong to the current owner
    execute format(
      'update public.%I set user_id = %L where user_id is null', t, owner_id);

    -- 3. Default to the signed-in user, and required
    execute format(
      'alter table public.%I alter column user_id set default auth.uid()', t);
    execute format(
      'alter table public.%I alter column user_id set not null', t);
    execute format(
      'create index if not exists %I on public.%I (user_id)', t || '_user_id_idx', t);

    -- 4. Only the owner can see or change a row
    execute format('alter table public.%I enable row level security', t);
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format(
      'create policy "Users manage their own rows" on public.%I '
      'for all to authenticated '
      'using (user_id = (select auth.uid())) '
      'with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

commit;
