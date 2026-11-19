# Site Progress Tracker

A mobile-first web app for tracking construction site progress by trade, item and location. Tap cells to cycle status (Not started / WIP / Done), mark no-work items, track changes over time, and manage multiple projects. All data is user-owned.

## Features

- Progress grid: locations x work items, tap to cycle status
- Per-item expected/actual dates, worker name, remarks
- Changes tab: snapshots of progress over time
- Multiple projects with copy-structure-from-existing
- Text backup / restore per project
- Cloud sync: email magic-link sign-in, per-user private storage

## Tech

React + TypeScript + Vite, static build deployable to any static host. Backend: Supabase (one table, row-level security per user). Hosted builds (`npm run build:hosted`) require `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and fail closed without them. `npm run build` without env runs fully local (localStorage only, no login) for development.

Apply `supabase/schema.sql` in the project's SQL editor first, then disable public sign-ups (Authentication > Providers > Email) after the owner's first sign-in.

## Privacy

No data is bundled with the app. Charts live in the signed-in user's private rows only. One-time chart import uses an `#import=` fragment link that is never sent to any server.
