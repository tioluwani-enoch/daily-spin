import { clamp01, cosineDistance } from "@/lib/utils/math";

import type { AudioFeatures } from "@/lib/db";
import type { Fingerprint } from "./types";

export function normalizeFeatures(features: AudioFeatures): Fingerprint {
  return {
    energy: features.energy,
    valence: features.valence,
    danceability: features.danceability,
    acousticness: features.acousticness,
    instrumentalness: features.instrumentalness,
    liveness: features.liveness,
    tempoNormalized: clamp01(features.tempo / 200)
  };
}

export function fingerprintToVector(fingerprint: Fingerprint): number[] {
  return [
    fingerprint.energy,
    fingerprint.valence,
    fingerprint.danceability,
    fingerprint.acousticness,
    fingerprint.instrumentalness,
    fingerprint.liveness,
    fingerprint.tempoNormalized
  ];
}

export function meanFingerprint(fingerprints: Fingerprint[]): Fingerprint {
  const keys = Object.keys(fingerprints[0]) as Array<keyof Fingerprint>;
  const result = {} as Fingerprint;

  for (const key of keys) {
    result[key] = fingerprints.reduce((sum, fingerprint) => sum + fingerprint[key], 0) / fingerprints.length;
  }

  return result;
}

export function getFingerprintDistance(a: Fingerprint, b: Fingerprint): number {
  return cosineDistance(fingerprintToVector(a), fingerprintToVector(b));
}
