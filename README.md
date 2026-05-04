# Daily Spin

A quiet daily companion for people who actively care about the music they listen to.

Daily Spin sits one layer above Spotify. It helps you rediscover music from your own library, track new releases from artists you explicitly care about, capture song recommendations before they disappear, and keep playlists from drifting away from their original feel.

No social feed. No streaks. No generic discovery firehose. Just a small, careful room for your music.

## What It Does

- Surfaces one ignored saved track every morning.
- Shows recent releases from your personal artist watchlist.
- Saves song recommendations into a capture inbox for later triage.
- Monitors playlists for drift, staleness, and abandonment.
- Suggests small playlist repairs using audio-feature fingerprints.
- Leaves room for Spin Companion, a Claude-powered chat layer grounded only in your music data.

## Current Status

Daily Spin is in early implementation.

Working now:

- Next.js App Router scaffold with TypeScript.
- Tailwind design system with ambient CSS variables.
- Supabase schema migration for the v1 data model.
- Feature-module structure from the docs.
- Demo-data dashboard at `/`.
- Playlist health overview and curation screen.
- Capture inbox UI and basic capture route.
- Morning Pick scoring algorithm with tests.

Not wired yet:

- Real Spotify OAuth and sync jobs.
- Real Supabase session-backed reads and writes.
- Claude/Spin Companion runtime calls.
- Production backfill, cron processing, and playlist mutations.

The full product spec lives in [`docs/`](docs/). Start with [`docs/index.md`](docs/index.md).

## Tech Stack

- **App:** Next.js 14, React, TypeScript
- **Styling:** Tailwind CSS, CSS variables for ambient theming
- **Data:** Supabase Postgres, RLS, SQL migrations
- **Music:** Spotify Web API
- **LLM:** Anthropic Claude
- **Tests:** Vitest
- **Package manager:** pnpm

## Getting Started

Install dependencies:

```bash
pnpm install
```

Create a local env file:

```bash
cp .env.example .env.local
```

Until Spotify sync is wired, the app shows empty setup states instead of fake listening data.

Start the dev server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

## Scripts

```bash
pnpm dev        # Start local development server
pnpm build      # Create a production build
pnpm start      # Run the production build
pnpm lint       # Run Next.js linting
pnpm typecheck  # Run TypeScript without emitting files
pnpm test       # Run Vitest unit tests
```

## Project Shape

```text
src/
  app/                 Next.js routes and API handlers
  modules/             Feature modules with public index.ts APIs
  lib/                 Cross-cutting infrastructure
  styles/              Global styles and Tailwind entrypoint
  types/               Shared TypeScript types

supabase/
  migrations/          SQL migrations for the database schema

docs/                  Product, architecture, module, and design specs
```

The module boundary rule is important: modules do not import from each other. Shared behavior goes through `lib/`, the database, or the Spin Companion tool dispatcher.

## Core Screens

- `/` - Morning ritual: pick, releases, capture inbox, playlist attention.
- `/playlists` - Playlist health overview.
- `/playlists/[playlistId]` - Curation view with fingerprint and suggestions.
- `/recap` - Weekly recap placeholder.

## License

To be decided before public release.
