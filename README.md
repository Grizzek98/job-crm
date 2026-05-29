# Job Application CRM

A personal job search tool I built for myself. It's a React app backed by Supabase that helps me track job opportunities, applications, interviews, and documents in one place — instead of juggling spreadsheets and browser tabs.

This is a single-user personal productivity app. It's not designed to be forked or self-hosted by others — the database schema, storage buckets, and OAuth credentials are all set up for my specific Supabase project.

---

## What it does

The core workflow: find a job listing → paste it into the app → it parses out the company, title, location, pay, requirements, etc. → I review and save. From there I can track the application through every stage (applied → interviewing → offered → accepted/rejected/etc.), log events like interviews and follow-ups, and store tailored resumes and cover letters.

### Main features

- **Job parser** — paste any job description and it extracts structured data (handles LinkedIn format, generic job boards, most common layouts)
- **CRM view** — unified table of companies, positions, contacts, and applications; everything sortable and searchable
- **Timeline** — calendar view of all activity, merged with Google Calendar
- **Dashboard** — positions needing attention, stale applications, daily goals with drag-to-reorder and confetti
- **Documents** — resume/cover letter storage with PDF preview
- **Focus tools** — YouTube video library with a persistent mini-player and Pomodoro timer
- **Smart Goals** — daily to-do list that auto-generates suggestions based on my job search activity

---

## Tech

React 19 + Vite, MUI v9, Supabase (PostgreSQL + Storage + Auth + Edge Functions), Google Calendar API, react-big-calendar, Recharts, TipTap, @dnd-kit, canvas-confetti. Hosted on GitHub Pages.

The job listing parser runs as a Supabase Edge Function (Deno). It tries a direct fetch first, falls back to Jina AI for bot-protected pages, and has special handling for LinkedIn's paste format.
