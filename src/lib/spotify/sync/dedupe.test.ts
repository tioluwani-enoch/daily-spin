import { describe, expect, it } from "vitest";

import { uniqueBy } from "./backfill";

describe("uniqueBy", () => {
  it("keeps one row per conflict key before upsert", () => {
    expect(
      uniqueBy(
        [
          { id: "a", value: 1 },
          { id: "b", value: 2 },
          { id: "a", value: 3 }
        ],
        (item) => item.id
      )
    ).toEqual([
      { id: "a", value: 3 },
      { id: "b", value: 2 }
    ]);
  });
});
