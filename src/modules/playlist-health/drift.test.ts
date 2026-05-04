import { describe, expect, it } from "vitest";

import { getHealthLabel } from "./drift";

describe("getHealthLabel", () => {
  it("marks abandoned playlists as dying before stale", () => {
    expect(getHealthLabel({ trackCount: 12, daysSinceLastEdit: 100, daysSinceLastPlay: 100, driftScore: 0.01 })).toBe("dying");
  });

  it("marks unedited and underplayed playlists as stale", () => {
    expect(getHealthLabel({ trackCount: 12, daysSinceLastEdit: 61, daysSinceLastPlay: 30, driftScore: 0.01 })).toBe("stale");
  });

  it("marks active playlists with high drift as drifting", () => {
    expect(getHealthLabel({ trackCount: 12, daysSinceLastEdit: 5, daysSinceLastPlay: 2, driftScore: 0.16 })).toBe("drifting");
  });

  it("keeps tiny playlists healthy because there is not enough signal", () => {
    expect(getHealthLabel({ trackCount: 4, daysSinceLastEdit: 120, daysSinceLastPlay: 120, driftScore: 0.7 })).toBe("healthy");
  });
});
