export type ScoreBreakdown = {
  recencyOfSave: number;
  underplay: number;
  affinity: number;
  novelty: number;
  composite: number;
};

export type MorningPick = {
  id: string;
  trackId: string;
  trackName: string | null;
  artists: string[];
  albumName: string | null;
  imageUrl: string | null;
  spotifyUrl: string | null;
  pickDate: string;
  reason: string;
  scoreBreakdown: ScoreBreakdown;
  dismissed: boolean;
  played: boolean;
};
