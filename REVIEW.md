# PR Review Criteria

The standing bar for reviewing pull requests on this project — especially
anything that touches **data isolation, auth, database migrations, or file
storage**, since the app is now multi-account and the security boundary *is*
the feature.

## How to use this

1. Judge each PR against the criteria below, **most-blocking first**.
2. Sort every finding into one of three buckets:
   - **Blocking** — data leak, data loss, or breaks the live site. Must fix before merge.
   - **Should-fix-before-ship** — convention violations, untested critical paths.
   - **Follow-up** — non-blocking hardening or a product decision; can be a later PR.
3. For anything that touches the database, RLS, or storage, run the
   **Verification Queries** at the bottom — and remember the apply **order**
   across coupled PRs (a correct PR can still break prod if merged out of order).

## Criteria (most-blocking first)

1. **Isolation completeness** — _the feature's actual job._
   Is there any path where account A can see or touch account B's data or files?
   Check every surface: all tables have `user_id` + an owner-only RLS policy;
   both storage buckets are private + per-user; no RLS-bypassing `rpc()` calls
   or views. One missed table = feature failed, even if everything else is perfect.

2. **Data safety / blast radius** — _there is no staging; prod is the only DB._
   Can it corrupt, delete, or expose existing records — and can you recover?
   Wants: a backup taken first, migrations wrapped in a transaction, a guard
   (e.g. "exactly one user") so data can't be misassigned, and **re-runnability**
   (safe to run twice / after a partial failure).

3. **Doesn't break the live app during rollout** — _judge the sequence, not just the diff._
   Can the site be half-deployed and still work? App-vs-migration order matters
   and differs per PR. State the apply order explicitly in the PR.

4. **Correctness of user-facing flows** — _test with a real second account._
   Signup, upload, preview, download, background images, etc. actually work
   end-to-end for a non-owner account. "Couldn't test, no second account" is a
   gap to close (see the dev database), not a pass.

5. **Fit with project conventions** — see `CLAUDE.md`.
   Service-layer split (`src/services/`), import Supabase only from
   `src/supabaseClient.js`, MUI-only, `sx={{}}` / `slotProps` (MUI v9), the
   established CRUD + shared-dialog patterns.

6. **Scope & reviewability** — one thing per PR, no unrelated drive-by changes.

7. **Sets the right pattern for future tables** — every new table follows
   `user_id uuid default auth.uid() not null` + an owner-only RLS policy, and
   every new uploaded file goes under `<user id>/…` in a private bucket.

## Project-specific gotchas (learned the hard way)

- **Every `VITE_` env var is baked into the public browser bundle.** Never put a
  real secret in one. Client-side keys (e.g. the YouTube Data API key) must be
  **restricted** (HTTP-referrer + API scope in Google Cloud) or proxied through a
  Supabase Edge Function. Don't assume `.env` = private; `.env` only keeps the
  value out of _source_ commits, not out of the deployed bundle.
- **Permissive RLS policies are OR'd together.** A single policy with
  `using (true)` opens a table to every authenticated user *even if* a correct
  `user_id = auth.uid()` policy also exists. Migrations must **drop all existing
  policies** on a table before adding the scoped one.
- **`rowsecurity = true` is necessary but not sufficient.** It only means RLS is
  *on* — you must also check the policy **predicate** actually scopes by user.
- **Supabase free tier pauses after ~7 days idle.** The keep-alive workflow
  (`.github/workflows/keepalive.yml`) handles this; don't remove it.

## Verification queries (Supabase SQL Editor)

Run before and after any isolation migration.

```sql
-- 1. Is RLS on, and how many policies, per table?
select t.tablename,
       t.rowsecurity as rls_enabled,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = t.tablename) as policies
from pg_tables t
where schemaname = 'public'
order by rls_enabled, tablename;

-- 2. THE important one: what does each policy actually allow?
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3. Storage buckets must be private.
select id, public from storage.buckets;

-- 4. Views can bypass RLS unless security_invoker — expect none.
select table_name from information_schema.views where table_schema = 'public';
```

**Pass conditions after a per-user migration:**

- Query 1: every table `rls_enabled = true`.
- Query 2: **exactly one** policy per table, every predicate `user_id = auth.uid()`
  (or equivalent) — and **zero** rows where `qual` is `true` or the policy is a
  blanket `auth_all` / "Authenticated users only".
- Query 3: both buckets `public = false`.
- Query 4: no rows (or every view is `security_invoker`).
