import type { NewRelease, WatchlistArtist } from "./types";

export async function listWatchlist(_userId: string): Promise<WatchlistArtist[]> {
  return [];
}

export async function addToWatchlist(_userId: string, _artistId: string): Promise<void> {
  return;
}

export async function removeFromWatchlist(_userId: string, _artistId: string): Promise<void> {
  return;
}

export async function setIncludeCompilations(_userId: string, _artistId: string, _include: boolean): Promise<void> {
  return;
}

export async function getRecentReleases(_userId: string, opts: { sinceDays?: number; limit?: number } = {}): Promise<NewRelease[]> {
  void opts;
  return [];
}

export async function dismissRelease(_releaseId: string): Promise<void> {
  return;
}

export async function markReleasePlayed(_releaseId: string): Promise<void> {
  return;
}

export async function suggestWatchlistSeeds(_userId: string): Promise<WatchlistArtist[]> {
  return [];
}
