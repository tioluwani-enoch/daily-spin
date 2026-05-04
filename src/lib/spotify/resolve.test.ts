import { describe, expect, it } from "vitest";

import { resolveSpotifyTrackId } from "./resolve";

describe("resolveSpotifyTrackId", () => {
  it("parses Spotify web URLs", () => {
    expect(resolveSpotifyTrackId("https://open.spotify.com/track/abc123?si=test")).toEqual({
      state: "resolved",
      trackId: "abc123"
    });
  });

  it("parses Spotify URIs", () => {
    expect(resolveSpotifyTrackId("spotify:track:xyz789")).toEqual({
      state: "resolved",
      trackId: "xyz789"
    });
  });

  it("keeps non-Spotify URLs for manual handling", () => {
    expect(resolveSpotifyTrackId("https://bandcamp.com/example")).toEqual({
      state: "unresolvable",
      notes: "non-Spotify source"
    });
  });
});
