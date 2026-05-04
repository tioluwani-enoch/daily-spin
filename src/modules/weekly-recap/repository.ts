import type { WeeklyRecap } from "./types";

export async function getCurrentRecap(_userId: string): Promise<WeeklyRecap | null> {
  return null;
}

export async function getRecap(_userId: string, _weekStart: string): Promise<WeeklyRecap | null> {
  return null;
}

export async function listRecaps(_userId: string, _opts: { limit?: number } = {}): Promise<WeeklyRecap[]> {
  return [];
}

export async function generateRecapForUser(userId: string, weekStart: string): Promise<WeeklyRecap> {
  return {
    id: `${userId}-${weekStart}`,
    weekStart,
    data: {
      weekStart,
      weekEnd: weekStart,
      totalPlays: 0,
      uniqueTracks: 0,
      uniqueArtists: 0,
      topTracks: [],
      topArtists: [],
      moodArc: [],
      returns: [],
      drifts: [],
      fellOut: []
    },
    prose: "A quiet week. Daily Spin will write this once listening history has enough signal.",
    generatedAt: new Date().toISOString()
  };
}
