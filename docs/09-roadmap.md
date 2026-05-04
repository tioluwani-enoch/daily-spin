# 09 · Roadmap

A phased build plan. Each phase is a standalone milestone — at the end of every phase, the app is shippable to yourself, even if not to the world.

The phases are ordered by dependency, not by excitement. Resist the temptation to build Spin Companion or voice before the core data pipeline is solid. The interesting parts get more interesting on top of a working base.

---

## Phase 0 · Foundations (1 weekend)

The boring but load-bearing work.

- Repo init, Next.js + TypeScript scaffold, Tailwind, ESLint, Prettier, lefthook.
- Supabase project, schema migrations for the v1 tables (`users`, `spotify_accounts`, `tracks`, `artists`, `albums`, `saved_tracks`, `listening_history`).
- Spotify developer app registered, OAuth callback wired, login page that signs you in and stores tokens.
- A single page at `/` that reads the signed-in user's display name from Supabase. Proof the auth and DB pipe is real.
- Type generation from Supabase committed.
- Vercel deploy of `main` branch with env vars set. PR previews working.

**Done when:** you can sign in with your Spotify account from the deployed URL and see "Hi, {name}" rendered.

---

## Phase 1 · Library and Morning Pick (1–2 weekends)

The core daily ritual without any embellishments.

- Initial library backfill job: page through `/me/tracks`, populate `tracks`, `artists`, `albums`, `saved_tracks`. Render a progress card during backfill.
- Audio features batch fetch for the user's library. Cache in `tracks.audio_features`.
- Recently-played sync running every 6 hours. Populate `listening_history`.
- Daily cron at 04:00 UTC that runs the library and history syncs and computes today's pick.
- `modules/morning-pick/algorithm.ts` implementing the scoring math.
- `<MorningPickCard />` rendered on `/`. Click opens Spotify. Dismiss regenerates.
- Reasons are deterministic templates in this phase (no Claude yet).

**Done when:** every morning at your local 7am, you open the deployed URL and see one track from your library you have been ignoring, with a generated reason. Click through to Spotify works.

---

## Phase 2 · Watchlist and Capture (1–2 weekends)

The other two morning-ritual sections.

- Watchlist CRUD and onboarding flow that seeds it from top artists.
- Daily release polling per watchlist artist; `new_releases` table populated; `<NewReleasesRow />` on the dashboard.
- Capture inbox: paste field, bookmarklet, resolution pipeline.
- Triage UI for the morning ritual screen — add to playlist, save, for-later, dismiss.
- Playlists table populated by daily sync (track-level data lazy-loaded).
- Add-to-playlist sheet with naive ordering (alphabetical for now; smart ordering in Phase 3).

**Done when:** the morning ritual screen has all three sections, the bookmarklet works on a real page, and you can triage captures into real playlists.

---

## Phase 3 · Playlist Health (1–2 weekends)

The signature feature.

- `playlist_tracks` populated for owned playlists.
- `playlist_fingerprints` computation, cached and invalidated correctly on snapshot changes.
- `<PlaylistList />` ranked by health label.
- Curation view per playlist: fingerprint radar, suggested adds, suggested removes.
- Triage's add-to-playlist sheet now uses fit scores to rank suggestions.
- Drift detection feeds into the morning ritual nudges (a small "your Sunday playlist is drifting" line if it's been drifting for >7 days).

**Done when:** you open the playlists view, see real health labels, and the suggestions feel right on at least three of your playlists.

---

## Phase 4 · Spin Companion (1 weekend)

The conversational layer.

- `lib/claude/` client with retries and a model router (Sonnet vs Haiku).
- `modules/spin-companion/prompt.ts` building the system prompt with user context.
- Tool definitions for `search_library`, `explain_morning_pick`, `get_playlist_health`, `propose_playlist_additions`, `propose_playlist_removals`, `add_track_to_playlist` (with confirmation flow), `triage_capture`, `compose_session_playlist`.
- Streaming chat sheet UI accessible from any screen.
- Reasons on the Morning Pick are now Companion-generated and cached.
- New release entries get a one-line context note from Companion.

**Done when:** you can ask "what should I play for a long walk in the rain" and get a sensible 8–15 track list pulled from your library.

---

## Phase 5 · Weekly Recap (1 weekend)

The Sunday-morning journal.

- Weekly cron Sunday 06:00 UTC + offset.
- `computeRecapData` and Companion prose generation.
- Recap page, mood arc chart, archive list.
- Email notification on Sunday morning (optional, off by default).

**Done when:** on Sunday at 8am, opening the app shows a recap that feels like it was written by someone who paid attention to your week.

---

## Phase 6 · PWA and ambient theming polish (1 weekend)

Make it feel like an app and finalize the visual identity.

- `manifest.json`, service worker via `next-pwa`, offline shell for the dashboard.
- Install prompts on iOS and Android.
- Ambient theming engine: palette extraction from album art, audio-feature modulation, BPM-tied pulse.
- Currently-playing polling tied into the theme provider.
- Reduced-motion respect and contrast clamping.
- Real typography choices locked in.

**Done when:** the app installs to your home screen, the background gently changes when a different track is playing, and the morning ritual feels quiet and considered rather than functional.

---

## Phase 7+ · Beyond v1

Things that live beyond the initial build, in rough order:

- Voice output: TTS via ElevenLabs for Companion responses (push to start, stops on tap).
- Voice input: Whisper for push-to-talk on the chat sheet.
- Apple Music adapter: same `lib/spotify/` interface, swappable backend.
- Native packaging via Capacitor (mobile) or Tauri (desktop) if PWA limitations bite.
- Yearly recap.
- Friend mode (private, opt-in song-share between mutuals — not a public feed).

Each item gets its own design pass before any code is written.

---

## What we are explicitly deferring

- Multi-tenant production hardening (rate limits, queueing, observability) until there is a second user.
- Account deletion flow (table cascade is enough until then).
- Localization. English-only in v1. Date formats follow user's browser locale.
- Mobile-specific gestures beyond the basics. The PWA inherits browser gestures and that is fine.
- Any integration that requires a partnership conversation (e.g., Bandcamp, Tidal).

---

## Working cadence

Build one phase per weekend. Use weeknights for design notes, dogfooding the prior phase, and noticing what is wrong. Resist the urge to add a feature mid-phase that belongs to a later one — write it down in `docs/09-roadmap.md` instead and keep going.
