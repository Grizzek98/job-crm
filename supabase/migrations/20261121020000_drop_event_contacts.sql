-- Drop the unused `event_contacts` junction table.
--
-- WHY WE'RE DROPPING IT
-- `event_contacts` was designed as a many-to-many link between `events` and
-- `contacts` (so one event could be tied to several people). In practice the
-- app never used it: as of Nov 2026 there is no code anywhere in `src/` that
-- reads or writes it, and it holds no data.
--
-- It mattered for the multi-account work (PRs #4/#5/#6). The per-user data
-- migration (20261121000000_per_user_data.sql) scopes every table to its owner
-- with a `user_id` column + RLS. A junction table doesn't fit that pattern
-- cleanly (it has no natural `user_id` of its own — ownership would have to be
-- derived from its parent event). Rather than carry an empty, unused table
-- through that design, we drop it. One less thing to keep isolated and verify.
--
-- IF YOU WANT IT BACK (e.g. to actually build event<->contact linking):
-- recreate it AND give it per-user isolation to match everything else. Roughly:
--
--   create table public.event_contacts (
--     event_id   uuid not null references public.events(id)   on delete cascade,
--     contact_id uuid not null references public.contacts(id) on delete cascade,
--     primary key (event_id, contact_id)
--   );
--   alter table public.event_contacts enable row level security;
--   -- A row is yours if its parent event is yours:
--   create policy "Users manage their own event_contacts"
--     on public.event_contacts for all to authenticated
--     using (exists (
--       select 1 from public.events e
--       where e.id = event_contacts.event_id
--         and e.user_id = (select auth.uid())))
--     with check (exists (
--       select 1 from public.events e
--       where e.id = event_contacts.event_id
--         and e.user_id = (select auth.uid())));
--
-- (The restore block is a starting point — double-check the column/PK shape
-- against whatever the feature actually needs.)

begin;

drop table if exists public.event_contacts;

commit;
