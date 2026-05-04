export type Fingerprint = {
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  tempoNormalized: number;
};

export type HealthLabel = "healthy" | "drifting" | "stale" | "dying";

export type PlaylistHealth = {
  playlistId: string;
  name: string;
  trackCount: number;
  coreCentroid: Fingerprint;
  recentCentroid: Fingerprint;
  driftScore: number;
  daysSinceLastEdit: number;
  daysSinceLastPlay: number | null;
  healthLabel: HealthLabel;
  computedAt: string;
};

export type Suggestion = {
  type: "add" | "remove";
  trackId: string;
  reason: string;
  fitScore: number;
};
