import { clamp01, cosineDistance, weightedChoice } from "@/lib/utils/math";
import type { TrackSummary } from "@/types/music";

export type ScoreBreakdown = {
  recencyOfSave: number;
  underplay: number;
  affinity: number;
  novelty: number;
  composite: number;
};

export type PickCandidate = TrackSummary & {
  playCount90: number;
  daysSinceLastPlay: number | null;
};

const FEATURE_KEYS = [
  "energy",
  "valence",
  "danceability",
  "acousticness",
  "instrumentalness",
  "liveness"
] as const;

export function featureVector(track: Pick<TrackSummary, "audioFeatures">): number[] {
  return [
    ...FEATURE_KEYS.map((key) => track.audioFeatures[key]),
    clamp01(track.audioFeatures.tempo / 200)
  ];
}

export function meanVector(vectors: number[][]): number[] | null {
  if (vectors.length === 0) {
    return null;
  }

  return vectors[0].map((_, index) => vectors.reduce((sum, vector) => sum + vector[index], 0) / vectors.length);
}

export function scoreCandidate(candidate: PickCandidate, recentProfile: number[] | null, today = new Date()): ScoreBreakdown {
  const savedAt = new Date(candidate.savedAt);
  const daysSinceSaved = Math.max(0, Math.floor((today.getTime() - savedAt.getTime()) / 86_400_000));
  const recencyOfSave = clamp01((daysSinceSaved - 30) / 365);
  const underplay = 1 - clamp01(candidate.playCount90 / 5);
  const affinity = recentProfile ? 1 - cosineDistance(featureVector(candidate), recentProfile) : 0.5;
  const novelty = candidate.playCount90 === 0 ? 1 : clamp01((candidate.daysSinceLastPlay ?? 0) / 60);
  const composite = 0.3 * recencyOfSave + 0.3 * underplay + 0.25 * affinity + 0.15 * novelty;

  return {
    recencyOfSave,
    underplay,
    affinity,
    novelty,
    composite
  };
}

export function chooseMorningPick(
  candidates: PickCandidate[],
  recentProfile: number[] | null,
  pickedRecently: Set<string>,
  today = new Date(),
  random = Math.random
): { track: PickCandidate; scoreBreakdown: ScoreBreakdown } | null {
  const eligible = candidates.filter((candidate) => !pickedRecently.has(candidate.id));
  const pool = eligible.length > 0 ? eligible : candidates;

  if (pool.length === 0) {
    return null;
  }

  const scored = pool
    .map((candidate) => ({
      track: candidate,
      scoreBreakdown: scoreCandidate(candidate, recentProfile, today)
    }))
    .sort((a, b) => b.scoreBreakdown.composite - a.scoreBreakdown.composite || b.track.popularity - a.track.popularity);

  const topCount = Math.max(1, Math.ceil(scored.length * 0.05));
  const top = scored.slice(0, topCount);
  return weightedChoice(top, (item) => item.scoreBreakdown.composite, random);
}

export function buildDeterministicReason(track: TrackSummary, score: ScoreBreakdown): string {
  const strongest = Object.entries({
    recencyOfSave: score.recencyOfSave,
    underplay: score.underplay,
    affinity: score.affinity,
    novelty: score.novelty
  }).sort((a, b) => b[1] - a[1])[0]?.[0];

  if (strongest === "affinity") {
    return "This matches the tempo and energy you have been circling lately.";
  }

  if (strongest === "recencyOfSave") {
    return `You saved ${track.name} a while back, and it has been waiting quietly.`;
  }

  if (strongest === "novelty") {
    return "This has been absent from your recent plays long enough to feel fresh again.";
  }

  return "You have barely played this lately, which makes it a good rediscovery pick.";
}
