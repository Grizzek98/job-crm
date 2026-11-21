# Kickoff — Multi-Account Testing

> **This is a temporary handoff note.** Once the tasks below are done, it should
> be deleted so these one-off notes don't pile up. (Claude: when the work in this
> file is complete and the PRs have been reported back on, delete `KICKOFF.md`,
> commit the deletion, and mention that you did.)

---

You're all set up to start on the multi-account work — here's the lay of the land.

A local development database setup is on `master`, so you can test the three PRs
against a throwaway local copy of the backend instead of our live data.
**Pull `master` first.**

## What's in the repo

- **`DEV_SETUP.md`** — step-by-step runbook for spinning up a local Supabase stack
  in Docker. You can hand it to Claude Code and have it walk you through setup.
- **`REVIEW.md`** — the review bar these PRs are held to, plus the SQL queries that
  verify isolation.
- A captured copy of the production schema (as a migration) so your local DB
  matches prod.

## Your mission

**Validate all three PRs locally before anything is applied to production.** Follow
`DEV_SETUP.md` — especially §3, which walks the real rollout rehearsal: sign up an
"owner" account, apply the #5 and #6 migration SQL in the local SQL editor, sign up
a second account, and confirm they're isolated.

### What to check on each PR

- **#5 (per-user data):** after applying it, a second account sees **none** of the
  first account's companies / positions / contacts / etc. Then run the verification
  queries from `REVIEW.md` — every table should show exactly one policy,
  `user_id = auth.uid()`, and zero `true` / `auth_all` policies.
- **#6 (per-user files):** uploads land in per-user folders; a second account can't
  see or open the first's documents or background images; and preview + download +
  background-image-select all still work (they use signed URLs now).
- **#4 (sign-up page):** the create-account flow works end to end, and the edge
  cases behave — password mismatch, too-short password, already-registered email,
  and the links between sign-in / sign-up. (Email confirmation is off locally, so
  signups are instant.)

### How to report back

For each PR, note **"works as-is"** or **"found X"** with steps to reproduce. If
something needs fixing, push the fix to that PR's branch for re-review.

## Good to know

- Everything happens on your **local** DB — don't apply anything to production.
  Wipe and replay anytime with `supabase db reset`.
- Heads-up on the migrations: the `if user_count <> 1` guard is correct for prod,
  but it means a fresh local DB (0 users) can't auto-replay them — that's why the
  runbook has you apply them by hand after the first signup. Fine as-is; if you ever
  want the smoother `db reset` loop, relaxing it to `> 1` would do it. Your call.

---

_When these tasks are complete, delete this file (see the note at the top)._
