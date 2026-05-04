# 03 · Tech Stack

Every choice here has a rationale. If you are tempted to swap something out, read the rationale first.

---

## Frontend: Next.js 14+ (App Router) + TypeScript

**Why:** Server Components let the morning ritual screen render with zero client-side data fetching, which is the right shape for a page that should feel instant. App Router gives clean routing for the auth shell, dashboard, playlists, and companion sheet. TypeScript is non-negotiable for a project this data-heavy — Spotify response shapes alone justify it.

**Notes:**
- Use Server Components by default. Mark a component `"use client"` only when it needs state, effects, or browser APIs.
- Route handlers (`app/api/.../route.ts`) for server endpoints, not the legacy Pages API.
- Use `next/font` for self-hosted fonts (no external font CDN; preserves the calm, no-flash feel).

## Styling: Tailwind CSS + CSS variables

**Why:** Tailwind handles every static utility need. The ambient theme — palette and motion derived from the playing track — is driven by CSS variables that Tailwind utilities read through `theme.extend.colors` configured to reference `var(--ambient-*)`. This gives us "Tailwind for static design, CSS variables for ambient theming" without two systems fighting each other.

**Notes:**
- Tailwind config exposes ambient tokens: `bg-ambient`, `text-ambient-fg`, `border-ambient-edge`, etc.
- All animation timing uses CSS variables so audio features can modulate motion (`--ambient-pulse-ms` derived from BPM).
- No CSS-in-JS. No styled-components. Tailwind only.

## Database: Supabase (Postgres + Auth + RLS)

**Why:** Hosted Postgres, built-in auth, row-level security, generous free tier, fast dashboard for a solo dev. Avoids the operational overhead of self-hosted Postgres while keeping standard SQL. Realtime channels are available if we ever want them (unlikely for v1).

**Notes:**
- Use the Supabase JS client only inside `lib/db/`. Modules import typed query functions from there, not the raw client.
- Generate types from the schema with `supabase gen types typescript` and commit the output. Modules consume those types.
- RLS policies: every table is locked down so users can only see their own rows. Even though the app is single-tenant feeling, RLS is cheap insurance.

## Music data: Spotify Web API

**Why:** Best public API of any major streaming service. Audio features endpoint (energy, valence, tempo, danceability, acousticness, instrumentalness, liveness, speechiness) is the foundation for the playlist fingerprint logic. Library, listening history, playlist read/write, and new releases are all exposed.

**Notes:**
- OAuth scopes needed (full list in `docs/05-spotify-integration.md`): `user-library-read`, `user-read-recently-played`, `user-top-read`, `playlist-read-private`, `playlist-read-collaborative`, `playlist-modify-private`, `playlist-modify-public`, `user-follow-read`, `user-read-currently-playing`.
- Rate limits are per-user-token. Cron jobs are scheduled to spread load.
- Spotify is currently restricting some endpoints for new third-party apps — `audio-features` and `audio-analysis` may require an extended-quota application for production scale. For personal use, the dev-mode quota is sufficient. Confirm current state at the start of Phase 1.

## LLM: Anthropic Claude

**Why:** Best reasoning over structured user data, lowest hallucination rate for grounded contexts, native tool-use API. The Companion's value depends on it never inventing facts about songs or artists; Claude handles that constraint better than the alternatives.

**Notes:**
- Use the Anthropic SDK directly in `lib/claude/`. No abstraction layer; we picked one provider on purpose.
- Tool use is the core mechanism: Claude calls our defined tools (search library, get playlist health, etc.) and composes responses from tool results.
- Cost-control: cache the daily "why this pick" reasons as static strings; only call Claude live for the chat sheet and weekly recap.

## Background jobs: Vercel Cron

**Why:** Built into Vercel, declared in `vercel.json`, no extra service. Daily and weekly cadences are exactly what we need. If job complexity grows (parallel per-user processing, retries, fan-out), we migrate to Inngest, but not before.

**Notes:**
- Cron entries live in `vercel.json` and point at `/api/cron/*` routes.
- Each cron route is idempotent and verifies the `CRON_SECRET` header before running.
- Long-running per-user work uses queue semantics inside the cron handler (process N users, then return; the next run picks up where we left off).

## Voice (later phases)

**TTS for Spin Companion intros and recaps:**
- Default: ElevenLabs (best naturalness, "Adam" or a custom voice).
- Fallback: OpenAI `tts-1` or `tts-1-hd` (cheaper, fast).

**STT for voice input:**
- OpenAI Whisper API (`whisper-1`). Cheap and fast for the push-to-talk use case.

Voice ships in Phase 4. Do not build it earlier.

## Hosting: Vercel

**Why:** Zero-config Next.js deploys, edge functions, cron jobs, free tier covers personal scale. Preview deployments per PR are useful while iterating on UI.

## Tooling

- **Package manager:** `pnpm` — faster, stricter, less disk.
- **Linter / formatter:** `eslint` + `prettier` with the Next.js + Tailwind plugins.
- **Type checking:** `tsc --noEmit` in CI; `tsconfig.strict` is on.
- **Git hooks:** `lefthook` (or `husky`) running lint and typecheck on staged files.
- **Testing:** `vitest` for unit and module tests; `playwright` for the few E2E flows worth covering (auth, daily sync, capture triage). E2E is added in Phase 2, not Phase 1.

## What we are NOT using and why

- **No Redux / Zustand / global state.** Server Components plus URL state plus React's built-in primitives cover everything we need.
- **No tRPC.** Our API surface is small and irregular; standard route handlers are clearer.
- **No Prisma.** Supabase's typed client + generated types is already enough; adding Prisma adds a build step and a migration system that conflicts with Supabase migrations.
- **No CSS-in-JS.** Performance and Server Component compatibility.
- **No design library (MUI, Chakra, etc.).** The visual identity is too specific — ambient theming would fight a generic component library. We build small, owned primitives.
- **No analytics SDK in v1.** No PostHog, no Vercel Analytics. The product is private by design; we do not collect behavioral data on users.

## Versioning policy

- Pin minor versions, allow patch updates: `^14.2.x` is fine; `^14.x.x` is not.
- Major version upgrades happen behind a branch and get a deliberate review.
