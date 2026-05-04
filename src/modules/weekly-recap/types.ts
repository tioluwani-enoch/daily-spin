export type MoodSegment = {
  date: string;
  centroid: { energy: number; valence: number; tempoNormalized: number; acousticness: number };
  totalPlays: number;
};

export type RecapData = {
  weekStart: string;
  weekEnd: string;
  totalPlays: number;
  uniqueTracks: number;
  uniqueArtists: number;
  topTracks: Array<{ trackId: string; plays: number }>;
  topArtists: Array<{ artistId: string; plays: number }>;
  moodArc: MoodSegment[];
  returns: Array<{ trackId: string; lastPlayedBefore: string }>;
  drifts: Array<{ playlistId: string; driftScore: number }>;
  fellOut: Array<{ trackId: string; lastWeekPlays: number }>;
};

export type WeeklyRecap = {
  id: string;
  weekStart: string;
  data: RecapData;
  prose: string;
  generatedAt: string;
};
