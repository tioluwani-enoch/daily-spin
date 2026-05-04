# Module · Artist Watchlist

## Purpose

A user-curated list of artists Daily Spin watches for new releases. The watchlist replaces algorithmic discovery feeds with a deliberate, user-defined signal: only show me when these specific artists drop something.

The point: zero noise, zero "because you listened to..." dilution. If an artist is on the list, the user wants to know. If they are not, they do not.

---

## Public API

Exported from `src/modules/artist-watchlist/index.ts`:

```typescript
export type WatchlistArtist = {
  artistId: string;
  name: string;
  imageUrl: string | null;
  addedAt: string;
  includeCompilations: boolean;
};

export type NewRelease = {
  id: string;                 // new_releases.id
  album: {
    id: string;
    name: string;
    type: "album" | "single" | "compilation";
    releaseDate: string;      // YYYY-MM-DD
    imageUrl: string | null;
    artistIds: string[];
  };
  surfacedAt: string;
  dismissed: boolean;
  played: boolean;
};

export async function listWatchlist(userId: string): Promise<WatchlistArtist[]>;
export async function addToWatchlist(userId: string, artistId: string): Promise<void>;
export async function removeFromWatchlist(userId: string, artistId: string): Promise<void>;
export async function setIncludeCompilations(userId: string, artistId: string, include: boolean): Promise<void>;

export async function getRecentReleases(userId: string, opts?: { sinceDays?: number; limit?: number }): Promise<NewRelease[]>;
export async function dismissRelease(releaseId: string): Promise<void>;
export async function markReleasePlayed(releaseId: string): Promise<void>;

export async function suggestWatchlistSeeds(userId: string): Promise<WatchlistArtist[]>;
```

`suggestWatchlistSeeds` is used during onboarding: it returns the user's top 30 artists by play count, ready to confirm or remove.

---

## Data ownership

**Reads:** `watchlist_artists`, `new_releases`, `albums`, `artists`.

**Writes:** `watchlist_artists`, `new_releases`.

The module does not write to `albums` or `artists` directly — those caches are populated by `lib/spotify` when fetching album details.

---

## Behavior

### Adding to the watchlist

1. User taps "add" on an artist anywhere in the app (or via Companion command).
2. `addToWatchlist` upserts into `watchlist_artists`.
3. If we do not already have the artist in the cache, fetch and store via `lib/spotify`.
4. Trigger a one-off backfill: fetch the artist's albums in the last 14 days; for any in-window release, insert into `new_releases` so the user sees it on their next open.

### Daily release polling

Runs as part of the daily sync cron. For each user:

```
for each artist in watchlist_artists:
  resp = spotify.GET /artists/{id}/albums?
            include_groups=album,single&
            market={user.country}&
            limit=20
  for each album in resp:
    if album.release_date is within last 14 days
       and (album.album_type !== 'compilation' OR include_compilations)
       and not already in new_releases for this user:
      cache album in albums/artists tables
      insert row into new_releases
```

Spotify returns albums in reverse-chron, so we can short-circuit once we hit one outside the window.

### Freshness window

Default is **14 days**. Releases older than 14 days fall off the morning ritual feed automatically (the dashboard query filters on `surfaced_at`). They remain in the database for analytics but do not surface to the UI unless the user explicitly browses an "older" view (Phase 2).

### Filtering rules

- `album_type = 'compilation'` is filtered by default.
- `release_date_precision = 'year'` (no day-precision) — surface only if the year matches the current year *and* the album was added to Spotify in the last 14 days. Use the `added_at` from the API response as a fallback signal.
- Re-releases and remasters: include them but tag visually so the user can see they are not new material.
- Featured-on credits ("Various Artists feat. X") are not surfaced. We watch the artist as a primary, not as a featured guest. (Phase 2: optional setting to include features.)

---

## UI surface

This module owns:

- `src/modules/artist-watchlist/ui/NewReleasesRow.tsx` — the morning ritual section.
- `src/modules/artist-watchlist/ui/WatchlistSettings.tsx` — the settings page list (add, remove, toggle compilations).
- `src/modules/artist-watchlist/ui/AddArtistDialog.tsx` — search-and-add modal.

Each new-release card shows: small album art, artist names (linked), album title, release type badge (`single`, `EP`, `LP`, or `re-release`), release date, and one play action that opens Spotify.

---

## When it runs

- **Daily release polling:** part of the per-user daily sync cron at 04:00 + offset.
- **One-off backfill on add:** in-request when a user adds a new artist.
- **Search:** in-request when adding from the modal (`/search?type=artist`).

---

## Edge cases and failure modes

- **Artist no longer on Spotify.** The watchlist row stays; polling fails silently with a logged warning. Surface a "not found" indicator after 3 consecutive failures.
- **An artist drops six singles in a week.** The dashboard row caps at 5 visible items with a "+N more" link to a full list view.
- **A surprise album drop predated the cron run.** The freshness window catches it; the user sees it on their next open.
- **Watchlist cap reached (>100 artists).** Adding more is allowed but the UI warns: "you are watching 102 artists; consider trimming." We never hard-block.
- **Region-locked release.** If `markets` does not include the user's country, we skip it. Optionally surface as "out of region" in a Phase 2 enhancement.
- **Companion misuse:** if the user asks the Companion to "follow" an artist, that gets routed to `addToWatchlist`. Watchlist is *not* the same as Spotify's "Following" — we keep these separate so the user has full control.

---

## Tests

Unit:

- Filtering logic (compilation, re-release tagging, region filter).
- Date math for the freshness window across timezones.

Integration:

- Daily polling against a Spotify API mock — verify idempotency and correct insertions.
- Backfill on add — verify a recent release surfaces immediately.

E2E (Phase 2):

- Add artist via search, verify they appear in settings and that any in-window releases land on the dashboard.

---

## Onboarding flow specific to this module

After OAuth, the user sees a one-screen "pick your watchlist" view powered by `suggestWatchlistSeeds`:

- Shows the user's top 30 artists by play count.
- Each is selected by default. Tap to deselect.
- Search bar to add others.
- Skip button to bypass and curate later.

The watchlist is the *one* setup task we ask the user to do. Everything else can wait.
