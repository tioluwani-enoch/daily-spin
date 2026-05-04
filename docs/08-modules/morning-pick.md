# Module · Morning Pick

## Purpose

Surface one track from the user's saved library each day, picked to encourage rediscovery rather than novelty. The Morning Pick is the first thing the user sees on the morning ritual screen, and it is the product's quiet daily promise: today, listen to something you already love but have been ignoring.

This module is rediscovery, not recommendation. The candidate set is always the user's own library. The work is in choosing well.

---

## Public API

Exported from `src/modules/morning-pick/index.ts`:

```typescript
export type MorningPick = {
  id: string;                  // daily_picks.id
  trackId: string;
  pickDate: string;            // YYYY-MM-DD
  reason: string;              // Companion-generated, one sentence
  scoreBreakdown: ScoreBreakdown;
  dismissed: boolean;
  played: boolean;
};

export type ScoreBreakdown = {
  recencyOfSave: number;       // 0-1, higher = saved longer ago
  underplay: number;           // 0-1, higher = played less recently
  affinity: number;            // 0-1, higher = matches recent listening profile
  novelty: number;             // 0-1, higher = unfamiliar in last 90 days
  composite: number;           // weighted sum
};

export async function getTodayPick(userId: string): Promise<MorningPick | null>;
export async function regenerateTodayPick(userId: string): Promise<MorningPick>;  // user dismissed; pick another
export async function markPlayed(pickId: string): Promise<void>;
export async function markDismissed(pickId: string): Promise<void>;
export async function explainPick(pickId: string): Promise<string>;  // calls Companion for a fresh explanation
```

Nothing else from this module is public.

---

## Data ownership

**Reads:** `saved_tracks`, `tracks`, `listening_history`, `daily_picks` (history).

**Writes:** `daily_picks`.

The module does not write to anything else. It does not call Spotify directly. If a regeneration pick is dismissed, the original `daily_picks` row gets `dismissed = true` and a new row is inserted for the same `pick_date`.

---

## Algorithm

The job: pick one track from the user's saved library that is **rediscovery-worthy**.

Inputs:

- `S` = saved tracks where `removed_at IS NULL` and `audio_features_fetched_at IS NOT NULL`.
- `H90` = listening history for the last 90 days.
- `H7` = listening history for the last 7 days.
- `H7_features` = mean audio features over `H7` (the "recent profile vector").
- `picked_recently` = track ids picked in the last 14 days (to avoid repeats).

Score each candidate `t ∈ S` and `t.id ∉ picked_recently`:

```
recencyOfSave = clamp01((daysSinceSaved(t) - 30) / 365)
  // 0 if saved less than 30 days ago, 1 if saved over 13 months ago

underplay = 1 - clamp01(playCount90(t) / 5)
  // 1 if played 0 times in 90 days, 0 if played 5+ times

affinity = 1 - cosineDistance(t.audio_features, H7_features)
  // 1 if perfectly matches recent vibe, 0 if opposite

novelty = playCount90(t) === 0 ? 1 : clamp01(daysSinceLastPlay(t) / 60)
  // 1 if never played in 90 days, otherwise scaled by absence

composite = (
  0.30 * recencyOfSave +
  0.30 * underplay +
  0.25 * affinity +
  0.15 * novelty
)
```

Sample the pick from the **top 5%** of candidates by composite score using weighted random selection (so the pick feels considered but not deterministic). Tie-break with `tracks.popularity desc` to slightly prefer better-known tracks within the top set.

If the candidate set after filtering is empty (very new user, tiny library, or everything has been picked recently), fall back in this order:

1. Drop the `picked_recently` constraint.
2. Drop the affinity term (a fresh user has no recent profile).
3. Pick the least-played saved track at random.

---

## Reason generation

After choosing the track, generate a one-sentence reason via Spin Companion using a tightly-scoped prompt:

```
Inputs to Claude:
- Track: { name, artists, audio_features }
- Score breakdown: { recencyOfSave, underplay, affinity, novelty }
- Optional: original save context (date, was it from a session?)

Ask: "Write one sentence (under 25 words, no emojis) explaining why
this track surfaced today. Reference the strongest signal. Do not
invent context. Examples of strong signals to reference:
- Saved long ago and rarely played
- Matches a tempo/energy you've been into
- First return after a long absence"
```

The reason is generated once, cached in `daily_picks.reason`, and reused if the user opens the app multiple times that day. Regenerating only happens on dismissal.

---

## UI surface

This module owns:

- `src/modules/morning-pick/ui/MorningPickCard.tsx` — the card component used on the dashboard.
- `src/modules/morning-pick/ui/PickReasonSheet.tsx` — the expandable "why this" detail.
- `src/modules/morning-pick/ui/DismissDialog.tsx` — the small confirm before regenerate.

The dashboard route at `app/(dashboard)/page.tsx` imports and composes these.

The card shows: small album art (48px), track name, artists, the one-sentence reason, and three actions (play, dismiss, expand). Pulse animation on the album art tied to the track's BPM (only when the user hovers — never autoplays).

---

## When it runs

**Daily at the user's local 04:00** (best-effort; we run a single global cron and stagger by `user.created_at` mod 60 minutes). The cron route calls `computeAndCachePick(userId)` which writes the row and the reason in one go.

**On-demand regeneration:** when a user dismisses today's pick, `regenerateTodayPick(userId)` runs in their request and returns a new pick synchronously. Cap at 3 dismissals per day; after the third, show the user a "we're out of strong picks for today" state and surface a top-5 fallback list to choose from.

---

## Edge cases and failure modes

- **Library has no audio features yet.** Backfill is in progress. Show a placeholder card with a friendly note.
- **Empty library.** Show an onboarding nudge to import or save tracks. No pick.
- **User has only ever played one genre.** The affinity term will dominate; that is correct behavior. The user gets familiar surfaces.
- **Companion fails to generate a reason.** Fall back to a deterministic templated reason ("Saved February 2024, played twice"). Log the failure.
- **Spotify says the track is unavailable in the user's region.** Mark the saved track unavailable and re-pick.
- **Cron job runs twice.** The unique constraint on (`user_id`, `pick_date`, `track_id`) plus an upsert guard prevents duplicates.

---

## Tests

Unit:

- `algorithm.ts` scoring math: each scoring function in isolation, then `composite` end-to-end.
- Edge cases: empty candidate set, ties, picked_recently exclusion.

Integration:

- `repository.getTodayPick` and `regenerateTodayPick` against a seeded test DB.
- Idempotency of the cron path.

Snapshot / golden:

- A small fixture user with a known library and history produces a known top-5 candidate set.

E2E (Phase 2):

- User opens dashboard, sees a pick, clicks dismiss, sees a new pick.

---

## Open questions (resolve in Phase 1)

- Should saved tracks added in the *same week* as a heavy listening run be excluded from scoring (because they are clearly the user's current obsession)? Initial answer: yes, exclude tracks saved in the last 7 days.
- Should we surface "first time pick" tracks differently in the UI? Initial answer: not for v1; the reason text already does that work.
