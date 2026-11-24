# Local Development Database

This sets up a **local** Supabase stack on your machine — a full Postgres + Auth +
Storage copy of the app's backend, running in Docker — so you can develop and
test (including signing up multiple accounts to verify multi-account isolation)
**without ever touching the production database.**

Everything here runs locally. You do **not** need the production database password.

> Following this with Claude Code? You can hand it this file and ask it to run
> the steps. The only things you do by hand are installing Docker, clicking
> around the app, and pasting the per-user migration SQL in step 3.

---

## Prerequisites (install once)

- **Docker Desktop** — installed and **running** before any `supabase` command.
  https://docs.docker.com/desktop
- **Supabase CLI** — https://supabase.com/docs/guides/cli (check: `supabase --version`)
- **Node.js** + app deps — `npm install`

---

## 1. Start the local stack

From the repo root:

```bash
supabase start
```

First run pulls Docker images (a few minutes). When it finishes it prints a block
of URLs and keys — reprint it anytime with `supabase status`.

Starting automatically builds the schema from the baseline migrations:

| Migration | What it creates |
| --- | --- |
| `00000000000000_base_schema.sql` | All tables, triggers, functions (a snapshot of production's schema) |
| `00000000000001_local_storage_buckets.sql` | The `documents` + `backgrounds` storage buckets |
| `20261121020000_drop_event_contacts.sql` | Drops the unused junction table |

You now have an empty local database with the app's current (single-user-era) schema.

---

## 2. Point the app at local

Edit `.env` in the repo root. Only two values change from production — grab them
from `supabase status`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<the "Publishable" key from `supabase status`>

# Optional locally — only needed if you're testing these specific features:
VITE_GOOGLE_CLIENT_ID=
VITE_YOUTUBE_API_KEY=
```

> The local keys are shared defaults printed by the CLI — **not secret**, and the
> same every time. Keep your production `.env` values somewhere safe so you can
> switch back by swapping these two lines.

Then run the app and create a test account:

```bash
npm run dev
```

Email confirmation is **off** locally, so signup is instant — any email/password
works. (Any confirmation emails show up in Mailpit at http://127.0.0.1:54324,
never a real inbox.)

---

## 3. Rehearse the multi-account rollout (the real test)

The per-user migrations (PRs #5 and #6) are **not** auto-applied, on purpose: they
include a safety guard that refuses to run unless exactly **one** account exists —
which is exactly how they run in production. So you rehearse the real sequence:

1. With the stack running, **sign up your first account** in the app. This is the
   "owner" — the stand-in for your real production account.
2. Open the local **Studio SQL editor**: http://127.0.0.1:54323 → SQL Editor.
3. Paste and run, **in order**:
   - PR #5 — `supabase/migrations/20261121000000_per_user_data.sql`
   - PR #6 — `supabase/migrations/20261121010000_per_user_files.sql`

   (Get these by checking out the PR branch, or copy the SQL straight from the PR
   on GitHub.)
4. **Sign up a second account.**
5. **Verify isolation:**
   - The second account sees **none** of the first account's data (companies,
     positions, contacts, etc.).
   - Upload a document and a background image on each account — neither account
     can see or open the other's files.
   - In the SQL editor, run the verification queries from **`REVIEW.md`**: every
     table should show exactly one policy with `user_id = auth.uid()`, no
     `true` / `auth_all` policies, and both buckets `public = false`.

If isolation holds here, the same migrations can be trusted on production.

> **Tip:** to run the whole rehearsal again from scratch, `supabase db reset`
> wipes the database and replays the baseline migrations (back to an empty
> single-user schema), then repeat from step 1.

---

## Everyday commands

| Command | What it does |
| --- | --- |
| `supabase status` | Reprint local URLs + keys |
| `supabase stop` | Shut the stack down (keeps your local data) |
| `supabase db reset` | Wipe and rebuild from the baseline migrations (fresh empty DB) |
| Studio → http://127.0.0.1:54323 | Browse tables + run SQL locally |

---

## Notes & gotchas

- **Switching local ⟷ prod** is just the two `.env` lines in step 2. Never point
  `npm run deploy` at local.
- **No production data is ever copied here.** The baseline is schema only — you
  create your own test data.
- **Google Calendar / YouTube** features need the real keys (and authorized
  origins) to work; leave them blank while testing everything else.
- If `supabase start` reports a migration failed or the schema is stale,
  `supabase db reset` rebuilds cleanly.
- The base schema is a point-in-time snapshot of production (captured 2026-11-21).
  If the production schema changes, re-capture it with
  `supabase db dump --schema public -f supabase/migrations/00000000000000_base_schema.sql`
  (requires production access — owner only).
