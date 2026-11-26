-- Attach a Resume Builder resume to an application.
--
-- applications.resume_id points at an uploaded file in `documents`. Builder
-- resumes live in `resumes`, so this adds a second, optional link:
--   * applications.builder_resume_id -> resumes(id). If that resume is deleted,
--     the application just loses the link (set null).
--   * An application uses one or the other, never both.
--   * The RLS policy also checks that a linked builder resume belongs to the
--     same person, so nobody can link someone else's resume id. Foreign key
--     checks ignore RLS, so the policy has to check it.
--
-- Requires 20261121000000_per_user_data.sql (#5) and 20261126000000_resumes.sql
-- (#10). Safe to run more than once.

begin;

alter table public.applications
  add column if not exists builder_resume_id uuid references public.resumes(id) on delete set null;

create index if not exists applications_builder_resume_id_idx on public.applications (builder_resume_id);

alter table public.applications drop constraint if exists applications_one_resume;
alter table public.applications
  add constraint applications_one_resume check (resume_id is null or builder_resume_id is null);

-- Same owner-only rule as #5, plus the builder resume ownership check.
drop policy if exists "Users manage their own rows" on public.applications;
create policy "Users manage their own rows"
  on public.applications
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      builder_resume_id is null
      or exists (
        select 1 from public.resumes r
        where r.id = builder_resume_id and r.user_id = (select auth.uid())
      )
    )
  );

commit;
