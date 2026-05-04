# Module · Weekly Recap

## Purpose

A quiet Sunday-morning journal entry that makes the user's listening week legible to them. Not a Spotify Wrapped clone. Not a leaderboard. Not a stats dashboard. A short, prose-led snapshot the user can read in two minutes and revisit later.

The recap exists because most listeners can't articulate what they've been into lately, even though they have strong feelings about it. The recap surfaces the patterns they would notice if they had time to notice them.

---

## Public API

Exported from `src/modules/weekly-recap/index.ts`:

```typescript
export type RecapData = {
  weekStart: string;                 // ISO date, Monday
  weekEnd: string;                   // ISO date, Sunday
  totalPlays: number;
  uniqueTracks: number;
  uniqueArtists: number;
  topTracks: Array<{ trackId: string; plays: number }>;       // top 5
  topArtists: Array<{ artistId: string; plays: number }>;     // top 5
  moodArc: MoodSegment[];
  returns: Array<{ trackId: string; lastPlayedBefore: string }>;
  drifts: Array<{ playlistId: string; driftScore: number }>;
  fellOut: Array<{ trackId: string; lastWeekPlays: number }>;  // tracks heavy last week, gone this week
};

export type MoodSegment = {
  // A coarse 7-element array (one per day) of audio-feature centroids.
  date: string;
  centroid: { energy: number; valence: number; tempoNormalized: number; acousticness: number };
  totalPlays: number;
};

export type WeeklyRecap = {
  id: string;
  weekStart: string;
  data: RecapData;
  prose: string;                      // Companion-generated narrative
  generatedAt: string;
};

export async function getCurrentRecap(userId: string): Promise<WeeklyRecap | null>;
export async function getRecap(userId: string, weekStart: string): Promise<WeeklyRecap | null>;
export async function listRecaps(userId: string, opts?: { limit?: number }): Promise<WeeklyRecap[]>;
export async function generateRecapForUser(userId: string, weekStart: string): Promise<WeeklyRecap>;
```

---

## Data ownership

**Reads:** `listening_history`, `tracks`, `artists`, `playlists`, `playlist_fingerprints`, `daily_picks`.

**Writes:** `weekly_recaps`.

---

## When it runs

A weekly cron runs Sunday at 06:00 UTC + per-user offset (so users in different timezones get their recap when they wake up Sunday morning).

For each active user with at least 10 listening events that week:

1. Compute `RecapData` from listening history.
2. Pass the data to Spin Companion to generate prose.
3. Insert into `weekly_recaps`.

Users with fewer than 10 plays that week get a small "quiet week" placeholder, not a full recap.

---

## Computing the data

Pseudocode for `computeRecapData(userId, weekStart)`:

```
range = [weekStart, weekStart + 7 days)
plays = listening_history where played_at ∈ range

totalPlays = plays.length
uniqueTracks = new Set(plays.map(p => p.trackId)).size
uniqueArtists = new Set(plays.flatMap(p => p.track.artistIds)).size

topTracks = groupBy(plays, "trackId").orderBy(count desc).take(5)
topArtists = aggregateByArtist(plays).orderBy(plays desc).take(5)

moodArc = for each day d in range:
  daysPlays = plays where played_at falls on d
  centroid = mean(daysPlays.map(p => normalize(p.track.audio_features)))
  return { date: d, centroid, totalPlays: daysPlays.length }

// Returns: tracks played this week that hadn't been played in the prior 60 days
priorWindow = listening_history where played_at ∈ [weekStart - 60 days, weekStart)
playedPrior = new Set(priorWindow.map(p => p.trackId))
returns = topTracks.filter(t => !playedPrior.has(t.trackId))
                    .map(t => ({ trackId: t.trackId, lastPlayedBefore: ... }))

// Drifts: playlists whose drift score increased meaningfully this week
drifts = playlists.map(p => {
  prevDrift = p.fingerprint.driftScore at weekStart
  currDrift = p.fingerprint.driftScore at weekEnd
  delta = currDrift - prevDrift
  return delta > 0.05 ? { playlistId, driftScore: currDrift } : null
}).filter(notNull)

// Fell-out: tracks that were heavy last week but gone this week
prevPlays = listening_history where played_at ∈ [weekStart - 7d, weekStart)
prevTopTracks = topN(prevPlays, by trackId, 10)
currTrackSet = new Set(plays.map(p => p.trackId))
fellOut = prevTopTracks.filter(t => !currTrackSet.has(t.trackId)).take(3)
```

All vectors and counts are stored in the structured `data` column. Prose is regenerated from `data` if needed.

---

## Prose generation

Spin Companion writes the recap. The prompt is shaped around the structured data, not free-form generation.

Inputs to Claude:

- The `RecapData` object.
- The user's display name and a short reminder of the Companion's voice rules.

Asked output:

- Under 200 words total.
- Three or four paragraphs.
- Reference at least one specific track or artist from the data.
- Reference at least one pattern from the mood arc.
- Reference one return or one drift if any are non-empty.
- End with one open question for the user (no questions framed as homework — invitations only).

Tone is observational and warm, never congratulatory.

Example shape (illustrative, not a fixed template):

> A quieter week. You played 47% ambient and folk on Monday and Tuesday — slower than your usual — and the mood arc lifts after Wednesday into something more rhythmic.
>
> "[Track Name]" came back into rotation for the first time since February. Your "Sunday Mornings" playlist drifted slightly toward higher tempos this week; you might want a look.
>
> What pulled you toward the harder edits midweek?

---

## UI surface

This module owns:

- `src/modules/weekly-recap/ui/RecapPage.tsx` — the recap reading view.
- `src/modules/weekly-recap/ui/MoodArcChart.tsx` — a small line/area chart of the mood arc.
- `src/modules/weekly-recap/ui/RecapList.tsx` — the archive of past recaps.
- `src/modules/weekly-recap/ui/QuietWeekPlaceholder.tsx` — for low-listening weeks.

The recap page is one centered column, generous reading width (640px max), serif-leaning typography for the prose, mono accents for stats. No hero image. The mood arc is small and lives below the prose, not above.

---

## Edge cases and failure modes

- **User listened to almost nothing.** Show the quiet-week placeholder. No prose generation. (Not even an LLM cost.)
- **Companion fails to generate prose.** Fall back to a templated paragraph constructed from the structured data. The recap is still useful without the prose.
- **A track in the recap was deleted from Spotify.** Render it as plain text from cached metadata; it does not need to be playable.
- **Privacy.** Recaps are never shared. Even the export functionality (Phase 3) produces a personal HTML file, not a public link.
- **Late generation.** If the cron job is delayed and a user opens the app on Sunday before generation, show a "your recap is being prepared" placeholder. On-demand generation can be triggered with a button if the cron has clearly missed.

---

## Tests

Unit:

- Mood arc computation across edge cases (a day with zero plays, a day with one play).
- Returns and fell-out detection logic.
- Drift delta calculation against synthetic fingerprint history.

Integration:

- Full recap generation against a seeded user with known listening history.
- Prose fallback when Claude is unavailable.

---

## Future shape (not v1)

- Yearly recap built by aggregating weeklies.
- Optional shareable static export (a single self-contained HTML page).
- Comparison with the previous month or quarter.

None of these belong in v1. The week-by-week journal is the product; everything else is a tangent.
