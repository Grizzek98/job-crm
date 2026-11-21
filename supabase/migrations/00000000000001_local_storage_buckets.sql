-- LOCAL DEV BASELINE (part 2): create the storage buckets that exist in
-- production, so a fresh local database has them to work with.
--
-- Idempotent: does nothing where the buckets already exist (including prod, if
-- this ever ran there by accident). Created `public = true` to match prod's
-- original state — the per-user-files migration (PR #6) is what flips them to
-- private. See DEV_SETUP.md.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', true),
       ('backgrounds', 'backgrounds', true)
on conflict (id) do nothing;
