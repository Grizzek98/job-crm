-- Resume builder, step 3: tailored resumes.
--
-- A tailored resume is a copy of the master resume made for one job
-- (position). Editing it never changes the master. This adds:
--   * resumes.position_id: which job a tailored copy is for. If the job is
--     deleted, the copy is kept and just loses its link (set null), so no
--     tailoring work is lost.
--   * at most one tailored copy per job per person;
--   * the master resume can't be linked to a job;
--   * the RLS policy also checks that a linked job belongs to the same person,
--     so nobody can link their resume to someone else's job id.
--
-- Requires 20261126000000_resumes.sql. Safe to run more than once.

begin;

alter table public.resumes
  add column if not exists position_id uuid references public.positions(id) on delete set null;

create index if not exists resumes_position_id_idx on public.resumes (position_id);

create unique index if not exists resumes_one_per_position
  on public.resumes (user_id, position_id) where position_id is not null;

alter table public.resumes drop constraint if exists resumes_master_has_no_position;
alter table public.resumes
  add constraint resumes_master_has_no_position check (not (is_master and position_id is not null));

drop policy if exists "Users manage their own rows" on public.resumes;
create policy "Users manage their own rows"
  on public.resumes
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      position_id is null
      or exists (
        select 1 from public.positions p
        where p.id = position_id and p.user_id = (select auth.uid())
      )
    )
  );

commit;
