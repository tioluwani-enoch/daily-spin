# 04 · Data Model

The schema is intentionally small. Everything here serves at least one specific feature; nothing is "in case we need it later."

All tables have `created_at` and `updated_at` (managed by Supabase triggers). All foreign keys to `users` cascade on delete so a user can fully purge their data.

Row-level security is enabled on every table. The default policy is "user can read and write only their own rows."

---

## Tables

### `users`

Maps to the authenticated Spotify user. Created on first OAuth completion.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | Supabase auth user id |
| `spotify_id` | `text` UNIQUE | Spotify user id |
| `display_name` | `text` | from Spotify |
| `email` | `text` | from Spotify |
| `country` | `text` | for region-specific releases |
| `onboarded_at` | `timestamptz` NULL | non-null once they've finished setup |

### `spotify_accounts`

Token storage. One row per user. Tokens are encrypted at rest using Supabase's `pgcrypto`.

| column | type | notes |
|---|---|---|
| `user_id` | `uuid` PK FK→users | one-to-one |
| `access_token` | `text` | encrypted |
| `refresh_token` | `text` | encrypted |
| `expires_at` | `timestamptz` | for proactive refresh |
| `scopes` | `text[]` | granted scopes |

### `tracks`

Cached track metadata. Shared across users (a track is a track regardless of who saved it). Populated lazily when first encountered.

| column | type | notes |
|---|---|---|
| `id` | `text` PK | Spotify track id |
| `name` | `text` |  |
| `artist_ids` | `text[]` | references `artists.id` |
| `album_id` | `text` | FK→albums |
| `duration_ms` | `int` |  |
| `explicit` | `boolean` |  |
| `popularity` | `int` | 0-100, for tiebreakers |
| `audio_features` | `jsonb` | `{energy, valence, tempo, danceability, acousticness, instrumentalness, liveness, speechiness}` |
| `audio_features_fetched_at` | `timestamptz` NULL | null until we have features |

### `artists`

Cached artist metadata.

| column | type | notes |
|---|---|---|
| `id` | `text` PK | Spotify artist id |
| `name` | `text` |  |
| `genres` | `text[]` | from Spotify |
| `image_url` | `text` |  |

### `albums`

Cached album metadata. Used for the new-releases feed and art extraction.

| column | type | notes |
|---|---|---|
| `id` | `text` PK | Spotify album id |
| `name` | `text` |  |
| `artist_ids` | `text[]` |  |
| `album_type` | `text` | `album`, `single`, `compilation` |
| `release_date` | `date` |  |
| `release_date_precision` | `text` | `year`, `month`, `day` |
| `image_url` | `text` |  |

---

### `saved_tracks`

The user's library snapshot. The Morning Pick reads this constantly.

| column | type | notes |
|---|---|---|
| `user_id` | `uuid` FK→users |  |
| `track_id` | `text` FK→tracks |  |
| `saved_at` | `timestamptz` | from Spotify (when they saved it) |
| `last_seen_in_sync_at` | `timestamptz` | tombstone helper |
| PK | (`user_id`, `track_id`) |  |

If a track disappears from a sync, we mark it removed instead of deleting (`removed_at`).

### `listening_history`

Recent plays. Spotify only exposes the last 50 plays per user, so we sync frequently and accumulate.

| column | type | notes |
|---|---|---|
| `user_id` | `uuid` FK→users |  |
| `track_id` | `text` FK→tracks |  |
| `played_at` | `timestamptz` | from Spotify |
| `context_uri` | `text` NULL | playlist/album/artist URI |
| PK | (`user_id`, `track_id`, `played_at`) |  |

Indexed on (`user_id`, `played_at desc`) for fast recent-window queries.

---

### `watchlist_artists`

The user's curated list of artists to watch. Capped at 100 per user (soft limit, enforced in app code).

| column | type | notes |
|---|---|---|
| `user_id` | `uuid` FK→users |  |
| `artist_id` | `text` FK→artists |  |
| `added_at` | `timestamptz` |  |
| `include_compilations` | `boolean` default `false` | per-artist override |
| PK | (`user_id`, `artist_id`) |  |

### `new_releases`

The feed surfaced in the morning ritual. One row per (user, album) within the freshness window.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK |  |
| `user_id` | `uuid` FK→users |  |
| `album_id` | `text` FK→albums |  |
| `surfaced_at` | `timestamptz` | when our cron caught it |
| `dismissed_at` | `timestamptz` NULL |  |
| `played_at` | `timestamptz` NULL | true if user opened it |
| UNIQUE | (`user_id`, `album_id`) |  |

---

### `captures`

The inbox. Frictionless writes, deferred resolution.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK |  |
| `user_id` | `uuid` FK→users |  |
| `raw_input` | `text` | URL or "Artist - Track" string |
| `source` | `text` | `bookmarklet`, `share`, `paste`, `companion` |
| `track_id` | `text` FK→tracks NULL | populated once resolved |
| `resolution_state` | `text` | `pending`, `resolved`, `unresolvable` |
| `resolution_notes` | `text` NULL | e.g., "Bandcamp only" |
| `triaged_at` | `timestamptz` NULL |  |
| `triage_action` | `text` NULL | `added-to-playlist`, `saved`, `for-later`, `dismissed` |
| `triage_target` | `text` NULL | playlist id when relevant |

---

### `playlists`

User's playlists, owned or followed. Synced daily.

| column | type | notes |
|---|---|---|
| `id` | `text` PK | Spotify playlist id |
| `user_id` | `uuid` FK→users | the user this row is tracked for |
| `name` | `text` |  |
| `description` | `text` |  |
| `owner_id` | `text` | spotify user id of owner |
| `is_owned_by_user` | `boolean` |  |
| `track_count` | `int` |  |
| `snapshot_id` | `text` | Spotify's etag-equivalent; skip resync if unchanged |
| `last_played_at` | `timestamptz` NULL | derived from listening_history |
| `last_modified_at` | `timestamptz` | from Spotify or our writes |

### `playlist_tracks`

Position-tracked join table. Order matters because the fingerprint algorithm uses position to distinguish "core" vs. "recent" additions.

| column | type | notes |
|---|---|---|
| `playlist_id` | `text` FK→playlists |  |
| `track_id` | `text` FK→tracks |  |
| `position` | `int` |  |
| `added_at` | `timestamptz` |  |
| `added_by` | `text` | user id (collaborative playlists) |
| PK | (`playlist_id`, `track_id`, `position`) |  |

### `playlist_fingerprints`

Computed sonic fingerprints, recomputed when the track list changes.

| column | type | notes |
|---|---|---|
| `playlist_id` | `text` PK FK→playlists |  |
| `core_centroid` | `jsonb` | mean audio features over the first N tracks |
| `recent_centroid` | `jsonb` | mean over the last M tracks |
| `drift_score` | `real` | cosine distance, 0-1 |
| `health_label` | `text` | `healthy`, `drifting`, `stale`, `dying` |
| `computed_at` | `timestamptz` |  |

`N` and `M` defaults: 30 and 10. Configurable per playlist if needed.

---

### `daily_picks`

History of every Morning Pick the app has surfaced. Used to avoid repeats and to power the "explain why" feature.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK |  |
| `user_id` | `uuid` FK→users |  |
| `pick_date` | `date` |  |
| `track_id` | `text` FK→tracks |  |
| `reason` | `text` | one-sentence Companion-generated string |
| `score_breakdown` | `jsonb` | weights that produced this pick |
| `dismissed` | `boolean` default `false` |  |
| `played` | `boolean` default `false` |  |
| UNIQUE | (`user_id`, `pick_date`, `track_id`) |  |

### `weekly_recaps`

Generated each Sunday by the recap job. Stored as a structured object plus pre-rendered prose.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK |  |
| `user_id` | `uuid` FK→users |  |
| `week_start` | `date` | Monday of the week summarized |
| `data` | `jsonb` | top tracks, mood arc, returns, drifts, computed |
| `prose` | `text` | Companion-generated narrative |
| `generated_at` | `timestamptz` |  |
| UNIQUE | (`user_id`, `week_start`) |  |

### `companion_messages`

Spin Companion chat history. Per-conversation.

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK |  |
| `user_id` | `uuid` FK→users |  |
| `conversation_id` | `uuid` |  |
| `role` | `text` | `user`, `assistant`, `tool_result` |
| `content` | `jsonb` | message blocks (text, tool_use, tool_result) |
| `created_at` | `timestamptz` |  |

Indexed on (`user_id`, `conversation_id`, `created_at`).

---

## Indexes worth highlighting

- `saved_tracks (user_id, saved_at desc)` — Morning Pick scoring
- `listening_history (user_id, played_at desc)` — recency queries everywhere
- `playlist_tracks (playlist_id, position)` — fingerprint computation
- `new_releases (user_id, surfaced_at desc) where dismissed_at is null` — partial index for the morning feed

## Migrations

- All schema changes go through SQL migration files in `supabase/migrations/` named `YYYYMMDDHHMMSS_descriptive_name.sql`.
- No destructive migrations without a backup step.
- Type generation runs after every migration and the diff is committed in the same PR.

## Privacy

- Tokens are encrypted at rest.
- The Companion's chat history can be cleared by the user at any time (a single button in settings).
- A "delete everything" path drops all rows for a user; cascades handle it.
- We never share data across users. The `tracks`, `artists`, and `albums` tables are shared metadata caches, not user data.
