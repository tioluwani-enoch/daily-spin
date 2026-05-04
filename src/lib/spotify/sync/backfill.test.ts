import { describe, expect, it } from "vitest";

import { normalizeSpotifyPlaylistForStorage, normalizeSpotifyTrackForStorage } from "./backfill";

import type { SpotifyTrack } from "./types";

describe("normalizeSpotifyTrackForStorage", () => {
  it("defaults nullable Spotify fields before writing to strict database columns", () => {
    const track: SpotifyTrack = {
      id: "track-1",
      name: "Nobody",
      artists: [{ id: "artist-1", name: "Artist" }],
      album: {
        id: "album-1",
        name: "Album",
        album_type: null,
        release_date: null,
        release_date_precision: null,
        images: null,
        artists: [{ id: "artist-1", name: "Artist" }]
      },
      duration_ms: null,
      explicit: null,
      popularity: null
    };

    expect(normalizeSpotifyTrackForStorage(track)).toMatchObject({
      duration_ms: 0,
      explicit: false,
      popularity: 0
    });
  });
});

describe("normalizeSpotifyPlaylistForStorage", () => {
  it("defaults missing Spotify playlist track totals", () => {
    expect(
      normalizeSpotifyPlaylistForStorage(
        {
          id: "playlist-1",
          name: "Playlist",
          description: null,
          owner: null,
          tracks: undefined,
          snapshot_id: null
        },
        "user-1",
        "spotify-user",
        "2026-05-04T00:00:00.000Z"
      )
    ).toMatchObject({
      owner_id: "spotify-user",
      track_count: 0,
      snapshot_id: ""
    });
  });
});
