# Module · Playlist Health

## Purpose

Daily Spin's signature feature. Each playlist is monitored for **drift** (recent additions sliding away from the original sonic identity), **staleness** (unedited and underplayed), and **death** (effectively abandoned). The module computes fingerprints, surfaces health labels, and proposes concrete add/remove suggestions to keep playlists feeling like themselves over time.

This is the module that makes Daily Spin worth opening on the days you don't need a Morning Pick.

---

## Public API

Exported from `src/modules/playlist-health/index.ts`:

```typescript
export type Fingerprint = {
  // Centroid in 7-dimensional audio feature space.
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  tempoNormalized: number;       // tempo / 200, clamped 0-1
};

export type HealthLabel = "healthy" | "drifting" | "stale" | "dying";

export type PlaylistHealth = {
  playlistId: string;
  name: string;
  trackCount: number;
  coreCentroid: Fingerprint;
  recentCentroid: Fingerprint;
  driftScore: number;            // 0-1, cosine distance
  daysSinceLastEdit: number;
  daysSinceLastPlay: number | null;
  healthLabel: HealthLabel;
  computedAt: string;
};

export type Suggestion = {
  type: "add" | "remove";
  trackId: string;
  reason: string;                // short, computed, not Companion-generated
  fitScore: number;              // 0-1, higher is better fit
};

export async function getHealth(playlistId: string): Promise<PlaylistHealth>;
export async function listAllHealth(userId: string): Promise<PlaylistHealth[]>;
export async function recompute(playlistId: string): Promise<PlaylistHealth>;
export async function proposeAdditions(playlistId: string, opts?: { limit?: number; pool?: "library" | "watchlist" | "both" }): Promise<Suggestion[]>;
export async function proposeRemovals(playlistId: string, opts?: { limit?: number }): Promise<Suggestion[]>;
```

---

## Data ownership

**Reads:** `playlists`, `playlist_tracks`, `tracks`, `saved_tracks`, `watchlist_artists`, `listening_history`.

**Writes:** `playlist_fingerprints`.

The module does not write to playlists or playlist_tracks — those are owned by the sync layer in `lib/spotify`. When the user accepts a suggestion, the API route handler calls `lib/spotify.addToPlaylist` and then this module's `recompute`.

---

## Fingerprints

Every owned playlist has a fingerprint computed from its tracks' audio features. We compute two centroids per playlist:

- **Core centroid** — mean feature vector over the **first N tracks** (default `N = 30`). The intuition: when a user starts a playlist, the first 30 songs define what the playlist *is*.
- **Recent centroid** — mean feature vector over the **last M tracks** (default `M = 10`). What the playlist has been pulling in lately.

```
fingerprint(tracks):
  features = tracks.map(t => normalize(t.audio_features))
  return mean(features)
```

Where `normalize` divides `tempo` by 200 (clamped to [0, 1]) so it lives on the same scale as the rest. We exclude `speechiness` from the centroid because it varies too much within most users' tastes to be a meaningful axis. We use 7 dimensions, not 8.

For playlists with fewer than `N` tracks (small playlists), `core` is computed over all tracks and `recent` is computed over the last `min(M, count - N)` tracks. If there are fewer than 5 tracks total, fingerprinting is skipped (the playlist is too small to drift).

---

## Drift score

The drift score is the cosine distance between core and recent centroids, mapped to [0, 1]:

```
driftScore = cosineDistance(coreCentroid, recentCentroid)
            // = 1 - cosineSimilarity
```

Empirically (we will tune these thresholds during dogfooding):

- `< 0.05` → tightly on-vibe
- `0.05 – 0.15` → normal evolution
- `0.15 – 0.30` → drifting
- `> 0.30` → significantly drifted

The threshold for the "drifting" health label is `0.15` by default, configurable.

---

## Health label

A small decision tree:

```
if trackCount < 5:
  return "healthy"      // too small to evaluate
if daysSinceLastPlay >= 90 and daysSinceLastEdit >= 90:
  return "dying"
if daysSinceLastEdit >= 60 and daysSinceLastPlay >= 30:
  return "stale"
if driftScore >= 0.15:
  return "drifting"
return "healthy"
```

The order matters: a drifting-but-recently-played playlist is "drifting", not "stale". A playlist that hasn't been touched in months but is still played daily is "healthy" — it just isn't being maintained, which is fine.

`daysSinceLastPlay` is computed from `listening_history` joined to playlist track membership. If we cannot determine it (the user has very little history), we leave it null and skip the staleness check.

---

## Suggested additions

The interesting part. Given a playlist's `coreCentroid`, find tracks the user already loves (or that come from artists they care about) that match the centroid better than the playlist's recent additions do.

```
proposeAdditions(playlistId, { limit = 5, pool = "both" }):
  fp = getFingerprint(playlistId).coreCentroid
  existing = trackIds in playlist

  candidates = []
  if pool includes "library":
    candidates ++= savedTracks(userId) where id ∉ existing
  if pool includes "watchlist":
    candidates ++= top tracks of watchlist_artists where id ∉ existing
                    (cap at 200 candidates to keep the set tractable)

  scored = candidates.map(t => ({
    trackId: t.id,
    fitScore: 1 - cosineDistance(normalize(t.features), fp),
    // light bonuses:
    //   +0.05 if user has played this track in last 30 days
    //   +0.05 if the track shares an artist already in the playlist
    //   -0.10 if the track is in 5+ of the user's other playlists (avoid overuse)
  }))

  return scored.sortBy(fitScore desc).take(limit)
```

The `reason` string is computed deterministically (not Companion-generated) so it's fast and consistent:

- `"close fit on tempo and energy"`
- `"matches the playlist's calmer half"`
- `"by an artist already in this playlist"`
- `"saved 2024-03 — you haven't returned"`

We pick the strongest one per suggestion.

---

## Suggested removals

Identify outliers in the playlist — tracks whose feature vectors are unusually far from the **core centroid**, not the recent. The intent: surface songs that don't belong to what the playlist *was*, not to what it currently is.

```
proposeRemovals(playlistId, { limit = 3 }):
  fp = getFingerprint(playlistId).coreCentroid
  tracks = playlist tracks
  scored = tracks.map(t => ({
    trackId: t.id,
    distance: cosineDistance(normalize(t.features), fp),
  }))
  outliers = scored.filter(s => s.distance > 0.30)
  return outliers.sortBy(distance desc).take(limit).map(toSuggestion)
```

If no track exceeds the threshold, return an empty list — better to say "nothing to remove" than to recommend removing well-fitting songs.

We never auto-remove. The user makes every removal decision in the curation view.

---

## When fingerprints are recomputed

- After daily sync, for any playlist whose `snapshot_id` changed.
- After a triage action that modifies a playlist (capture added, suggestion accepted).
- After a Companion-driven mutation.
- On-demand if the user pulls-to-refresh in the playlist view.

Recomputation is cheap (mean of vectors over a few hundred tracks). We do not need a queue.

---

## UI surface

This module owns:

- `src/modules/playlist-health/ui/PlaylistList.tsx` — the playlists overview ranked by health.
- `src/modules/playlist-health/ui/HealthBadge.tsx` — the small label.
- `src/modules/playlist-health/ui/CurationView.tsx` — the per-playlist curation page with adds and removes.
- `src/modules/playlist-health/ui/FingerprintRadar.tsx` — a tiny radar chart showing core vs recent centroids.
- `src/modules/playlist-health/ui/SuggestionCard.tsx` — a single add or remove suggestion with accept/reject controls.

The curation view is one of the more visually interesting screens in the app. The radar visualization should feel quiet and informative, not like a stats dashboard.

---

## Edge cases and failure modes

- **Playlist has tracks without audio features.** Skip them in centroid computation. If more than half the playlist is missing features, mark health as `unknown` and show a "needs sync" indicator.
- **Playlist owned by someone else (followed playlist).** Show health, but disable add/remove actions — the user can't modify it. Suggestions become "consider building a similar one yourself" with a "fork to my own" button (Phase 2).
- **Playlist with one track.** Skip fingerprinting; show a "add a few more songs and we'll start watching this one" message.
- **All tracks in the playlist are recent.** Core and recent centroids will be similar. Drift score is low; healthy is correct.
- **User aggressively reorders a playlist.** We use position to define core vs recent. Reordering changes the fingerprint, which is correct behavior — the user has redefined what the playlist *is*.
- **Companion-driven removal.** Same path as a UI-driven removal: confirm sheet, then mutation, then recompute.

---

## Tests

Unit:

- `cosineDistance` and `mean` math.
- Health label decision tree across boundary values.
- Reason-string selection picks the strongest signal.

Integration:

- Seeded playlists with known feature vectors → known drift scores.
- Suggestion ranking with controlled candidate sets.

E2E (Phase 2):

- User opens curation view, accepts an addition, sees recompute reflected immediately.

---

## Tunable parameters (centralized)

These live in `src/modules/playlist-health/constants.ts` so they can be adjusted without hunting:

- `CORE_N = 30`
- `RECENT_M = 10`
- `DRIFT_THRESHOLD_DRIFTING = 0.15`
- `DRIFT_THRESHOLD_OUTLIER = 0.30`
- `STALE_DAYS_NO_EDIT = 60`
- `STALE_DAYS_NO_PLAY = 30`
- `DYING_DAYS_NO_PLAY = 90`
- `DYING_DAYS_NO_EDIT = 90`
- `MIN_TRACKS_FOR_FINGERPRINT = 5`

When a parameter changes, log the diff and recompute all fingerprints once.
