# 05 · Spotify Integration

Daily Spin is a Spotify-first product in v1. This document is the single source of truth for how we talk to Spotify.

All Spotify API calls go through `lib/spotify/`. No module imports the raw Spotify SDK directly.

---

## OAuth

### Scopes (request all on initial sign-in)

- `user-library-read` — saved tracks
- `user-read-recently-played` — listening history
- `user-top-read` — top tracks/artists for onboarding
- `playlist-read-private`
- `playlist-read-collaborative`
- `playlist-modify-private`
- `playlist-modify-public`
- `user-follow-read` — followed artists for watchlist seeding
- `user-read-currently-playing` — for the ambient theming engine

### Flow

Authorization Code with PKCE. NextAuth handles the dance. Token stored in `spotify_accounts`. Refresh handled in `lib/spotify/auth.ts`:

```
function getAccessToken(userId): Promise<string>
  - read row
  - if expires_at > now + 60s, return access_token
  - else: POST /api/token with refresh_token, update row, return new access_token
```

All Spotify API calls go through a wrapper that calls `getAccessToken` first. No module thinks about token expiry.

### Re-auth

If the refresh token is revoked (user disconnected the app from Spotify settings), we surface a "reconnect Spotify" banner on next sign-in. The user's data stays in the database; we just need a new token.

---

## Endpoints we use

| Purpose | Endpoint | Cadence |
|---|---|---|
| Saved tracks | `GET /me/tracks` | daily, paginated |
| Recently played | `GET /me/player/recently-played` | every 6 hours |
| Top tracks/artists | `GET /me/top/{type}` | weekly + onboarding |
| Followed artists | `GET /me/following?type=artist` | onboarding only |
| Artist albums | `GET /artists/{id}/albums` | daily per watchlist artist |
| Album details | `GET /albums/{id}` | on-demand, cached |
| Track details | `GET /tracks/{id}` (and `/tracks?ids=...`) | on-demand, cached |
| **Audio features** | `GET /audio-features?ids=...` | on-demand for new tracks, batch up to 100 |
| User playlists | `GET /me/playlists` | daily |
| Playlist tracks | `GET /playlists/{id}/tracks` | when `snapshot_id` changes |
| Add to playlist | `POST /playlists/{id}/tracks` | on user action |
| Remove from playlist | `DELETE /playlists/{id}/tracks` | on user action |
| Currently playing | `GET /me/player/currently-playing` | when ambient theme is active (client-side, polled) |
| Search | `GET /search` | on capture resolution |

### A note on audio-features

The `audio-features` endpoint is the foundation for Playlist Health. As of mid-2024, Spotify began restricting this endpoint for new third-party developer apps. For personal use under your own developer account it should still be available. Verify access at the start of Phase 1 by hitting the endpoint with your own token; if it returns 403, the project pivots to:

1. Using Spotify's `recommendations` endpoint with seed tracks (still available, returns related tracks but not feature vectors).
2. Computing fingerprints from track metadata + genre tags.
3. Falling back to a different provider (MusicBrainz + AcousticBrainz) for feature data.

Document the result of this check in an issue before writing fingerprint code.

---

## Sync strategy

### Initial backfill (on first sign-in)

Triggered after onboarding. Runs as a background job:

1. Page through `/me/tracks` to build the `saved_tracks` snapshot. Insert tracks and artists into shared cache as we go.
2. Page through `/me/playlists`, then for each playlist whose `is_owned_by_user` is true, fetch tracks and store in `playlist_tracks`.
3. Fetch followed artists; do not auto-add them to `watchlist_artists` (that's an onboarding decision the user makes).
4. Fetch recent listening history.
5. Batch-fetch `audio-features` for all tracks we've cached and don't have features for yet.
6. Compute initial `playlist_fingerprints` for all owned playlists.

Show a progress card on the dashboard during backfill. Render a placeholder for the morning ritual until backfill completes.

### Daily sync (cron, 04:00 UTC + per-user offset)

For each active user, in this order:

1. Refresh access token if needed.
2. Diff `/me/tracks` against `saved_tracks`; insert new, mark removed.
3. Pull `recently-played` and append to `listening_history` (idempotent on the PK).
4. For each watchlist artist, fetch `/artists/{id}/albums?include_groups=album,single&market=US`. Filter to releases in the last 14 days that we have not already surfaced. Insert into `new_releases`.
5. For each playlist, compare `snapshot_id`; if changed, refresh `playlist_tracks` and recompute the fingerprint.
6. Compute today's Morning Pick.

The whole job is idempotent. If it fails partway, the next run picks up cleanly.

### Throttling

Spotify rate limits are not strictly documented but observed at roughly 180 requests / minute / token. The daily job is tolerant — it processes one user at a time and takes its time. We use a token bucket in `lib/spotify/client.ts` to cap concurrent requests per user at 4.

If a 429 is returned, honor the `Retry-After` header and back off.

### On-demand fetches

Some calls happen in user time (capture resolution, manual playlist refresh). These go through the same client and the same rate limiter, but with higher priority.

---

## Errors and recovery

| Error | Handling |
|---|---|
| 401 Unauthorized | Refresh token, retry once. If refresh fails, mark account needing reconnect. |
| 403 Forbidden | Log the endpoint and the scope set. Do not retry. |
| 404 Not Found | Treat as removed. For tracks: do not delete the row, mark `unavailable`. |
| 429 Too Many Requests | Honor `Retry-After`, jittered backoff. |
| 5xx | Exponential backoff up to 3 retries. |
| Network error | Retry once, then surface to the job log. |

---

## Caching policy

- `tracks`, `artists`, `albums`: cached forever. Refresh metadata only when a user views something for the first time in 90+ days.
- `audio_features`: cached forever per track id. They never change.
- `recently-played`: append-only, never refetched.
- `playlist_tracks`: refreshed when `snapshot_id` changes.

We aggressively cache shared metadata to avoid burning rate limit on tracks every user already has.

---

## Capture resolution

When a user submits a capture (raw URL or text), `lib/spotify/resolve.ts`:

1. If the input contains a Spotify URL (`open.spotify.com/track/...` or `spotify:track:...`), parse the track id directly.
2. Else if it looks like a URL from a known service (YouTube, Bandcamp, Apple Music, SoundCloud), try to extract artist + title via lightweight scraping (Phase 2; Phase 1 just stores the URL and asks the user for the song title).
3. Else treat the input as `Artist - Title` and call `/search?q=...&type=track&limit=1`.

If resolution succeeds, populate `capture.track_id`. If it fails, set `resolution_state = 'unresolvable'` with a note.

---

## Currently-playing (ambient theme)

When the user has the app foregrounded and has opted in to ambient theming, the client polls `/me/player/currently-playing` every 5 seconds. The response feeds the theming engine. This polling stops when the tab loses focus.

Polling can be replaced with WebSockets in the future via Spotify's emerging realtime offerings, but polling is fine for v1 — five seconds of latency is invisible for ambient effects.
