import {
  DRIFT_THRESHOLD_DRIFTING,
  DYING_DAYS_NO_EDIT,
  DYING_DAYS_NO_PLAY,
  STALE_DAYS_NO_EDIT,
  STALE_DAYS_NO_PLAY
} from "./constants";

import type { HealthLabel } from "./types";

export function getHealthLabel(input: {
  trackCount: number;
  daysSinceLastEdit: number;
  daysSinceLastPlay: number | null;
  driftScore: number;
}): HealthLabel {
  if (input.trackCount < 5) {
    return "healthy";
  }

  if (
    input.daysSinceLastPlay !== null &&
    input.daysSinceLastPlay >= DYING_DAYS_NO_PLAY &&
    input.daysSinceLastEdit >= DYING_DAYS_NO_EDIT
  ) {
    return "dying";
  }

  if (
    input.daysSinceLastPlay !== null &&
    input.daysSinceLastEdit >= STALE_DAYS_NO_EDIT &&
    input.daysSinceLastPlay >= STALE_DAYS_NO_PLAY
  ) {
    return "stale";
  }

  if (input.driftScore >= DRIFT_THRESHOLD_DRIFTING) {
    return "drifting";
  }

  return "healthy";
}
