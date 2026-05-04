import { describe, expect, it } from "vitest";

import { chooseMorningPick, featureVector, scoreCandidate } from "./algorithm";

import type { TrackSummary } from "@/types/music";

const testTracks: TrackSummary[] = [
  {
    id: "track-a",
    name: "Track A",
    artists: [{ id: "artist-a", name: "Artist A" }],
    albumName: "Album A",
    imageUrl: null,
    spotifyUrl: null,
    savedAt: "2024-02-12T10:00:00.000Z",
    popularity: 61,
    audioFeatures: {
      energy: 0.42,
      valence: 0.48,
      tempo: 94,
      danceability: 0.58,
      acousticness: 0.62,
      instrumentalness: 0.36,
      liveness: 0.12,
      speechiness: 0.04
    }
  },
  {
    id: "track-b",
    name: "Track B",
    artists: [{ id: "artist-b", name: "Artist B" }],
    albumName: "Album B",
    imageUrl: null,
    spotifyUrl: null,
    savedAt: "2023-09-19T10:00:00.000Z",
    popularity: 55,
    audioFeatures: {
      energy: 0.28,
      valence: 0.38,
      tempo: 82,
      danceability: 0.4,
      acousticness: 0.78,
      instrumentalness: 0.68,
      liveness: 0.1,
      speechiness: 0.03
    }
  }
];

describe("morning pick algorithm", () => {
  it("rewards older, underplayed saved tracks", () => {
    const score = scoreCandidate(
      {
        ...testTracks[0],
        playCount90: 0,
        daysSinceLastPlay: null
      },
      featureVector(testTracks[0]),
      new Date("2026-05-04T12:00:00.000Z")
    );

    expect(score.recencyOfSave).toBeGreaterThan(0.8);
    expect(score.underplay).toBe(1);
    expect(score.novelty).toBe(1);
    expect(score.composite).toBeGreaterThan(0.75);
  });

  it("excludes recently picked tracks when another candidate exists", () => {
    const result = chooseMorningPick(
      [
        { ...testTracks[0], playCount90: 0, daysSinceLastPlay: null },
        { ...testTracks[1], playCount90: 0, daysSinceLastPlay: null }
      ],
      null,
      new Set([testTracks[0].id]),
      new Date("2026-05-04T12:00:00.000Z"),
      () => 0
    );

    expect(result?.track.id).toBe(testTracks[1].id);
  });
});
