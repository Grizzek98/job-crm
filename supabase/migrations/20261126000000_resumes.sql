-- Resume builder, step 1: one table that stores each person's resumes.
--
-- The whole resume (header, sections, jobs, bullets, order, hidden flags) is one
-- JSON document in `content`, so reordering is a single update and the PDF / Word
-- exports can render from the same data.
--
-- Per-account rules (same pattern as 20261121000000_per_user_data.sql):
--   * user_id defaults to auth.uid(), is required, and is deleted with the user;
--   * RLS on, with one owner-only policy.
--
-- Safe to run more than once. It doesn't depend on the per-user-data migration.

begin;

create table if not exists public.resumes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null default 'Master resume',
  -- The master resume is the one tailored copies will be made from (step 3).
  is_master   boolean not null default false,
  content     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists resumes_user_id_idx on public.resumes (user_id);

-- At most one master resume per person.
create unique index if not exists resumes_one_master_per_user
  on public.resumes (user_id) where is_master;

drop trigger if exists set_updated_at on public.resumes;
create trigger set_updated_at
  before update on public.resumes
  for each row execute function public.update_updated_at_column();

alter table public.resumes enable row level security;

drop policy if exists "Users manage their own rows" on public.resumes;
create policy "Users manage their own rows"
  on public.resumes
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.resumes to authenticated;
grant all on public.resumes to service_role;

commit;
