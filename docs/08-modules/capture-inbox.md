# Module · Capture Inbox

## Purpose

A frictionless way to save a song the second the user encounters it — from a friend's text, a YouTube video, a coffee shop, a tweet — so that recommendation does not get lost. The inbox is processed once a day during the morning ritual; nothing else.

The friction at capture time must be minimal. The friction at triage time can be slightly higher, because that's when the user is intentionally curating.

---

## Public API

Exported from `src/modules/capture-inbox/index.ts`:

```typescript
export type Capture = {
  id: string;
  rawInput: string;
  source: "bookmarklet" | "share" | "paste" | "companion";
  trackId: string | null;
  resolutionState: "pending" | "resolved" | "unresolvable";
  resolutionNotes: string | null;
  triagedAt: string | null;
  triageAction: "added-to-playlist" | "saved" | "for-later" | "dismissed" | null;
  triageTarget: string | null;        // playlist id when relevant
  createdAt: string;
};

export type CaptureInput = {
  rawInput: string;
  source: Capture["source"];
};

export async function createCapture(userId: string, input: CaptureInput): Promise<Capture>;
export async function listUntriaged(userId: string): Promise<Capture[]>;
export async function listAll(userId: string, opts?: { limit?: number; before?: string }): Promise<Capture[]>;
export async function resolveCapture(captureId: string): Promise<Capture>;  // re-runs resolution

export type TriageAction =
  | { type: "add-to-playlist"; playlistId: string }
  | { type: "save-to-library" }
  | { type: "for-later" }              // moves to the deep crate (Morning Pick can use it)
  | { type: "dismiss" };

export async function triageCapture(captureId: string, action: TriageAction): Promise<Capture>;
```

---

## Data ownership

**Reads:** `captures`, `tracks`.

**Writes:** `captures`. Triage actions cause writes through other modules' public APIs (e.g., `lib/spotify.addToPlaylist`, `lib/spotify.saveToLibrary`), but `capture-inbox` does not touch those tables directly.

---

## Capture flow

A capture is a write-fast, resolve-later operation. The four input paths land in the same `createCapture` function:

### 1. Web bookmarklet (Phase 1)

A small JavaScript snippet the user drags to their bookmark bar. When clicked on any page:

- If the page is a Spotify track URL: send the URL.
- Else: send `document.title + " " + window.location.href`.
- POSTs to `/api/captures` with `{ rawInput, source: "bookmarklet" }`.

The bookmarklet is the fastest way to ship capture before any native or PWA work.

### 2. Share-sheet target (Phase 2)

Once the app is installed as a PWA on iOS/Android, the share sheet target hits the same endpoint with the shared URL or text.

### 3. Paste field (Phase 1)

Inside the app, a single text input under the inbox accepts either a URL or "Artist - Track" text.

### 4. Companion command (Phase 1)

The user says "save Caroline Polachek's Bunny Is a Rider for me" in the Companion sheet. The Companion calls a tool that hits `createCapture` with `source: "companion"`.

---

## Resolution

`createCapture` does not block on resolution; it inserts the row with `resolution_state = 'pending'` and queues async resolution. The user does not wait.

`lib/spotify/resolve.ts`:

```
resolve(rawInput):
  if rawInput contains a Spotify track URL or URI:
    parse trackId, return { trackId }

  if rawInput contains a known-source URL (YouTube, Bandcamp, Apple Music, SoundCloud):
    Phase 1: store URL only, mark unresolvable with note "non-Spotify source"
    Phase 2: scrape minimal metadata from the page (title + artist), then search Spotify

  else if rawInput is plaintext:
    parse for "Artist - Track" pattern
    spotify.search({ q, type: "track", limit: 5 })
    pick the top result; if popularity < 20, mark unresolvable for user review
    return { trackId }
```

If resolution succeeds, update `captures` with `track_id` and `resolution_state = 'resolved'`.

If resolution fails or returns ambiguous results, set `resolution_state = 'unresolvable'` with a human-readable note. The triage UI shows these as "needs your input" and lets the user paste a corrected URL or pick from search results.

---

## Triage flow

The morning ritual screen surfaces all `untriaged` captures (resolved or unresolvable) in a single section. The user processes the inbox in a few seconds per item.

For each capture, the UI offers:

- **Add to playlist** — opens a sheet with playlists ranked by sonic fit (the playlist's fingerprint compared to the track's audio features). Tapping one calls `triageCapture` with `add-to-playlist`, which calls `lib/spotify.addToPlaylist` and then `playlist-health.recompute(playlistId)`.
- **Save to library** — adds to Spotify's saved tracks via `lib/spotify`.
- **For later** — sets the capture's `triage_action = 'for-later'`. These tracks become eligible for surfacing in the Morning Pick (the Pick algorithm gets a small boost for "for-later" tracks the user has had for >14 days).
- **Dismiss** — sets `triage_action = 'dismissed'`. Item disappears.

Triage is one-tap with confirm-by-default. No "are you sure" dialogs except for irreversible operations (which there are none of in this module).

### Bulk actions

If the inbox has more than 8 untriaged items, show a "review all" view that lets the user batch-dismiss or batch-save.

---

## UI surface

This module owns:

- `src/modules/capture-inbox/ui/InboxSection.tsx` — the morning ritual section.
- `src/modules/capture-inbox/ui/CaptureItem.tsx` — a single capture row with triage controls.
- `src/modules/capture-inbox/ui/AddToPlaylistSheet.tsx` — the playlist-fit suggestion sheet.
- `src/modules/capture-inbox/ui/PasteField.tsx` — the in-app paste input.
- `src/modules/capture-inbox/ui/UnresolvedReviewSheet.tsx` — the manual-resolution helper.

---

## When it runs

- **Capture write:** in-request, sub-200ms target. Async resolution kicked off via a server action or a queued job.
- **Resolution:** runs immediately after creation; retried up to 3 times with backoff if Spotify search fails.
- **Triage:** in-request when the user taps. The actual Spotify mutation is awaited so the user sees the result.

---

## Edge cases and failure modes

- **User pastes a Bandcamp URL.** Phase 1: stored, marked unresolvable with note. The user can manually paste a Spotify equivalent.
- **Search returns multiple plausible matches.** If the top match has popularity ≥ 20 and the second-best is significantly less confident, take the top match. Otherwise mark unresolvable and show the candidates in the review sheet.
- **Track is unavailable in user's region.** Resolved trackId is fine for storing; surface a region warning at triage time.
- **Track is already in the user's library.** Triage UI shows a "in your library" indicator. "Save to library" becomes "remove from library" with a different style.
- **Triage to a playlist the track is already in.** Skip the API call, show a toast "already in this playlist."
- **User tries to add to a collaborative playlist they don't own.** Honor it; Spotify allows this if scopes are granted.
- **Capture rate spikes from a single user.** No rate limit in v1, but log if a user creates >20 captures in 5 minutes for monitoring.

---

## Tests

Unit:

- `resolve()` parsing for each source type.
- "Artist - Track" parser handles weird whitespace, en-dashes, "by" separator.

Integration:

- `createCapture` → resolution → triage flow against seeded DB and Spotify mock.
- Already-in-playlist short-circuit.

E2E (Phase 2):

- Bookmarklet posts a Spotify URL → inbox shows resolved item next morning.

---

## Privacy note

Captures are private. Even the bookmarklet's POST is authenticated; we do not accept anonymous capture posts. The inbox is never displayed in any shared or public context.
