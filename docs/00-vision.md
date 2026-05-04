# 00 · Vision

## The problem

Streaming services are optimized for one metric: total listening minutes across all users. That goal pushes them toward sameness — algorithmic mixes that calm you, autoplay that never ends, recommendations that flatten your taste toward the global average. None of that is bad on its own. But it leaves a gap.

The gap is for people whose relationship with music is active. Curators. Diggers. Listeners who can name the producer of an album, who care about pressings and B-sides, who keep playlists the way other people keep gardens. For them, the streaming app is a record store, not a friend. It does not know why you saved that ambient track in February or why you have not opened it since. It does not notice when your "focus" playlist drifted from 90 BPM to 130 because you kept tossing in workout songs you did not mean to keep.

Daily Spin sits one layer above the streaming app and does the things the streaming app deliberately does not.

## The audience

Deep music listeners. Specifically:

- They keep more than 5 playlists they actually maintain.
- Their library has at least a few hundred saved tracks.
- They follow specific artists closely — release dates, side projects, label moves.
- They share music with friends and get music shared back.
- They have, at some point, been mildly annoyed at how their streaming service flattens their taste.

The product is not for casual listeners who put on a daily mix and forget about it. That market is well served already.

## What the product is

A daily companion. Not a player, not a social network, not a recommendation engine in the usual sense. The user opens it once or twice a day, processes a small amount of curated information, makes a few small decisions, and closes it. Total time spent in the app per day should be under five minutes most days.

The five things it does:

1. **Surface a track from your own library you have been ignoring** (the Morning Pick).
2. **Track new releases only from artists you have explicitly chosen** (the Watchlist).
3. **Catch song recommendations the moment they happen** so they do not get lost (the Capture Inbox).
4. **Monitor playlist drift, staleness, and death** and suggest small fixes (Playlist Health).
5. **Make your taste legible to yourself** through a weekly journal-style recap (Weekly Recap).

A conversational layer — Spin Companion, powered by Claude — wraps these features so the user can ask questions, request playlists for moments, and get short narrated context for what the app surfaces.

## What we are explicitly NOT building

This list matters as much as the feature list. Every "no" is a focusing decision.

- **No social network.** No followers, no public profiles, no shared activity feeds. Daily Spin is private by default.
- **No global discovery.** The app never recommends a song from outside your declared taste graph (your library plus your watchlist artists' catalogs).
- **No gamification.** No streaks, no badges, no levels, no daily login rewards.
- **No notifications.** The app does not push. The user comes to it.
- **No AI-generated music.** No synthesis, no remixing, no fake DJ chatter mid-track.
- **No replacing the player.** Daily Spin opens songs in Spotify (and later Apple Music). It does not stream audio itself.
- **No analytics dashboards for their own sake.** The Weekly Recap is a journal entry, not a Wrapped clone.

## Long-term vision

The product matures along three axes, in this order:

1. **Depth in your own library** — get the rediscovery, watchlist, capture, and playlist tools genuinely good.
2. **Spin Companion as a real friend** — text, then voice, then full conversational sessions where you can talk through a listening choice or a playlist build.
3. **Cross-platform parity** — Spotify first, Apple Music second, then optional local-library support for people with FLAC collections or Bandcamp.

Anything not in service of those three axes is a distraction.
