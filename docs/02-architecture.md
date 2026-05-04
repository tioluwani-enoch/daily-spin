# 02 · Architecture

## System shape

Daily Spin is a Next.js application with three distinct surfaces and four supporting services. Everything runs on Vercel except the database (Supabase) and the LLM (Anthropic).

```
┌──────────────────────────────────────────────────────────────────┐
│                         Next.js (Vercel)                         │
│                                                                  │
│  ┌─────────────┐   ┌─────────────┐   ┌────────────────────────┐  │
│  │ Web client  │   │  API routes │   │ Cron / scheduled jobs  │  │
│  │ (App Router)│   │  (Route Hand)│   │  (Vercel Cron)         │  │
│  └──────┬──────┘   └──────┬──────┘   └──────────┬─────────────┘  │
│         │                 │                     │                │
│         └─────────────────┼─────────────────────┘                │
└───────────────────────────┼──────────────────────────────────────┘
                            │
            ┌───────────────┼────────────────┐
            ▼               ▼                ▼
      ┌──────────┐   ┌──────────────┐  ┌──────────────┐
      │ Supabase │   │ Spotify API  │  │ Anthropic    │
      │ (Postgres│   │ (OAuth +     │  │ (Claude for  │
      │  + Auth) │   │   data)      │  │  Companion)  │
      └──────────┘   └──────────────┘  └──────────────┘
```

The three surfaces:

- **Web client.** React Server Components for the public landing and authenticated shells; Client Components for anything interactive (Companion chat, capture inbox triage, playlist curation view).
- **API routes.** Thin handlers. Most logic lives in the `lib/` modules; routes orchestrate.
- **Cron jobs.** Daily polling of Spotify per user (new releases, library snapshot diff, fingerprint recomputation). Weekly job for the Recap.

## Module map

The codebase is organized by feature, not by technical layer. Every module owns its own data access, business logic, and UI components.

```
src/
├── app/                          ← Next.js App Router
│   ├── (auth)/
│   ├── (dashboard)/              ← authenticated shell
│   │   ├── page.tsx              ← morning ritual screen
│   │   ├── playlists/
│   │   ├── companion/
│   │   └── recap/
│   ├── api/
│   │   ├── auth/
│   │   ├── spotify/              ← Spotify OAuth callbacks, token refresh
│   │   ├── companion/            ← Claude proxy + tool execution
│   │   └── cron/                 ← scheduled job entry points
│   └── layout.tsx
│
├── modules/                      ← FEATURE MODULES (the modular core)
│   ├── morning-pick/
│   │   ├── algorithm.ts
│   │   ├── repository.ts
│   │   ├── ui/
│   │   └── index.ts              ← module's public API
│   ├── artist-watchlist/
│   ├── capture-inbox/
│   ├── playlist-health/
│   │   ├── fingerprint.ts
│   │   ├── drift.ts
│   │   ├── repository.ts
│   │   └── ui/
│   ├── weekly-recap/
│   └── spin-companion/
│       ├── prompt.ts
│       ├── tools.ts              ← tools Claude can call
│       └── ui/
│
├── lib/                          ← cross-cutting infrastructure
│   ├── spotify/                  ← API client, rate limiting, token refresh
│   ├── claude/                   ← Anthropic client, retries
│   ├── db/                       ← Supabase client, typed queries
│   ├── theme/                    ← ambient theming engine
│   └── utils/
│
└── styles/
```

## Module boundary rules

These rules are non-negotiable. They protect modularity over time.

1. **Modules do not import from other modules.** If `playlist-health` needs library data, it goes through `lib/db/` or `lib/spotify/`, not through `modules/morning-pick/`.
2. **Each module exposes a thin public API via its `index.ts`.** External callers only see what the module chooses to export.
3. **Each module owns its own data access.** No shared "service layer" that grows into a god-object. Repository functions live next to the module they serve.
4. **UI components stay inside the module that owns them.** A `<MorningPick />` lives in `modules/morning-pick/ui/`, not in a global components folder. Truly generic primitives (Button, Sheet, Skeleton) live in `lib/ui/`.
5. **Cross-module behavior happens via the database or via Spin Companion tool calls.** Capture Inbox does not call Playlist Health directly; it writes a capture, and when the user triages, the triage UI calls Playlist Health's public API.

## Data flow patterns

### Read path (e.g., morning open)

```
User opens / → Server Component reads from Supabase
  → modules/morning-pick/repository.getTodayPick(userId)
  → modules/artist-watchlist/repository.getRecentReleases(userId)
  → modules/capture-inbox/repository.getUntriaged(userId)
→ render
```

The morning open is a single Server Component render. No client-side data fetching for the initial paint.

### Write path (e.g., capture triage)

```
Client component (triage button) →
  POST /api/captures/[id]/triage with { action: "add-to-playlist", playlistId } →
  modules/capture-inbox/triage.ts orchestrates:
    - lib/spotify add track to playlist
    - update capture status in DB
    - trigger playlist-health recompute for that playlist
  → return updated state to client
```

Writes are always server-side. The client never holds Spotify tokens.

### Background path (daily cron)

```
Vercel Cron @ 04:00 UTC → /api/cron/daily-sync →
  for each active user:
    - lib/spotify.refreshTokenIfNeeded()
    - lib/spotify.snapshotLibrary() → upsert into saved_tracks
    - modules/artist-watchlist.fetchNewReleases()
    - modules/morning-pick.computeTodayPick()
    - modules/playlist-health.recomputeFingerprints() (cheap when nothing changed)
```

The daily job is idempotent. Re-running it produces the same result.

## Spin Companion as orchestrator

Spin Companion is special: it is the only place where modules talk to each other indirectly. The Companion exposes a set of tools to Claude, each tool wraps a module's public API:

- `search_library(query)` → calls into the database
- `get_playlist_health(playlistId)` → calls `modules/playlist-health`
- `propose_additions(playlistId)` → calls `modules/playlist-health`
- `add_to_playlist(playlistId, trackId)` → calls `lib/spotify`
- `explain_morning_pick(date)` → calls `modules/morning-pick`

Claude decides which tools to call based on the user's message. This keeps the modules independent — they do not know about Claude — while letting the Companion compose them in flexible ways.

## Theming engine

The ambient theme is a system-wide concern but it lives in `lib/theme/` with a clean public surface so it does not pollute components.

- `lib/theme/extract.ts` extracts a palette from album art using a small color quantization function (no external image library; runs client-side).
- `lib/theme/audio.ts` maps audio features (energy, valence, tempo) to motion intensity and palette warmth.
- `lib/theme/provider.tsx` is a React context that holds the current theme and a setter. Components consume `useAmbientTheme()` and read CSS variables; they never read the theme object directly.

When a track plays, the provider updates CSS variables (`--ambient-bg`, `--ambient-accent`, `--ambient-pulse-ms`, etc.) on the root, and every component picks up the change automatically. No prop drilling. See `docs/07-design-system.md` for the visual specification.

## Auth

Spotify OAuth via NextAuth (or a custom thin wrapper if NextAuth's overhead feels too heavy). Tokens stored in Supabase, encrypted at rest. Refresh handled centrally in `lib/spotify/auth.ts` so no other module needs to think about token expiry.

Supabase Auth is used only for session management; the source of truth for the user's identity is their Spotify account.

## Deployment topology

- `main` branch deploys to production on Vercel.
- Preview deployments per PR.
- Database migrations live in `supabase/migrations/` and run via the Supabase CLI in CI.
- Secrets in Vercel env: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET`.

## Path to PWA → native

Phase 2 (PWA): add `manifest.json`, a service worker (Workbox via `next-pwa`), and an offline shell. No code changes elsewhere.

Phase 3 (native, only if needed): wrap with Capacitor for mobile or Tauri for desktop. The web app is the single source of truth; native is a thin shell.
