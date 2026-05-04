import { clamp01 } from "@/lib/utils/math";

import type { AudioFeatures } from "@/lib/db";

export type ThemeMotion = {
  pulseMs: number;
  energy: number;
  valence: number;
};

export function getThemeMotion(features: Pick<AudioFeatures, "energy" | "valence" | "tempo">): ThemeMotion {
  const beatMs = features.tempo > 0 ? (60_000 / features.tempo) * 2 : 1_200;

  return {
    pulseMs: Math.round(Math.min(1_800, Math.max(850, beatMs))),
    energy: clamp01(features.energy),
    valence: clamp01(features.valence)
  };
}
