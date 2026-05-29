# Job Application CRM

A personal job search command center — built for one person who wants to stay on top of their job hunt without losing things in spreadsheets or browser tabs.

**Live app:** https://grizzek98.github.io/job-crm

---

## What it does

Paste a job listing from LinkedIn, Indeed, or anywhere else and the app pulls out the company, title, location, pay, requirements, and more. From there you can track your application through every stage, log interviews and follow-ups, store tailored resumes and cover letters, and see everything in one place.

**Core workflow:**
1. Find a job → paste the listing into **Add Job** → review the parsed data → save
2. When you're ready to apply → hit **Apply** in the CRM → create an application record
3. Track status changes, interviews, offers, and follow-ups from the **CRM** and **Timeline**

---

## Features

### Job Tracking
- **Add Job** — paste any job description; AI parser extracts company, title, location, pay, requirements, benefits, and more (LinkedIn format + general heuristics)
- **CRM** — unified table view of all companies, positions, contacts, and applications; every column sortable; global search; application detail drawer with full event history
- **Positions** — full CRUD with auto-status management (`applied` is set automatically when you create an application record)
- **Companies** — full CRUD with Glassdoor rating tracking and color-coded chips
- **Contacts** — full CRUD linked to companies

### Applications & Events
- Applications created through the CRM "Apply" button — pre-fills the form with position data
- Full application status flow: applied → interviewing → offered → accepted/declined/rejected/withdrawn/ghosted
- Auto-generated activity log events on every create/update (position added, status changed, application created, etc.)
- Manual events: interviews, follow-ups, chats, offers, rejections

### Dashboard
- Stats cards: Total Applications, Applied This Week, Active Interviews, Offers
- **Positions Needing Attention** — three urgency tiers (stale / applying / unapplied) so nothing slips through
- **Stale Applications** — flags applications with no activity past your configured threshold
- **Smart Goals** — daily drag-to-reorder to-do list; three goal types (number, time, custom); auto-generated suggestions; confetti on completion

### Timeline & Calendar
- **Timeline** — react-big-calendar (Month/Week/Agenda views) with all your CRM events
- **Google Calendar integration** — connect your Google account and see all your calendars merged in; per-calendar toggle switches; event detail popovers

### Documents
- Upload resumes and cover letters (PDF/DOCX) to Supabase Storage
- PDF preview in-app, DOCX download
- Mark a document as your base/canonical version

### Focus Tools
- YouTube video library — save focus music / lo-fi playlists
- Persistent mini-player that survives navigation (draggable, volume slider, mute toggle)
- Star favorites — sorted to top, bold title
- **Pomodoro timer** — draggable, auto-advances phases, Web Audio chime on transition, confetti on work phase complete

### Productivity
- **Session time tracker** — tracks active tab time and sends encouraging nudges every N minutes (configurable; tab-visibility aware)
- **Sidebar global search** — search companies, positions, and contacts from anywhere; results navigate directly to the CRM
- **Job Sites directory** — preset + user-managed list of job boards with quick-open links

### Customization
- Theme colors: primary, secondary, and background — color swatches in Settings
- Background image upload (up to 10 images stored in Supabase)
- Pomodoro work/break duration, session tracker interval, stale/ghost day thresholds, daily goal count — all configurable in Settings

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| UI | MUI (Material UI) v9 |
| Charts | Recharts |
| Rich text | TipTap v3 |
| Drag-and-drop | @dnd-kit |
| Calendar | react-big-calendar + dayjs |
| Confetti | canvas-confetti |
| Hosting | GitHub Pages |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage |
| Auth | Supabase Auth (email/password) |
| Scraping | Supabase Edge Functions (Deno) |
| Calendar API | Google Calendar (OAuth2 GIS) |

---

## Local Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/Grizzek98/job-crm.git
   cd job-crm
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com) and set up the database schema (see the `Database Schema` section of `CLAUDE.md`).

3. **Create a `.env` file** in the project root:
   ```text
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_GOOGLE_CLIENT_ID=your_oauth_client_id
   ```

4. **Deploy the Edge Function** (for job parsing):
   ```bash
   supabase functions deploy scrape-job
   ```

5. **Run the dev server:**
   ```bash
   npm run dev
   ```

---

## Deployment

```bash
npm run deploy
```

Builds and pushes to the `gh-pages` branch via `gh-pages`. The `homepage` field in `package.json` controls the base URL.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |
| `npm run deploy` | Build and deploy to GitHub Pages |

---

*This is a personal productivity tool — single user, single Supabase project. Not designed for multi-tenant use.*
