import type { AudioFeatures } from "@/lib/db";

export type ArtistSummary = {
  id: string;
  name: string;
};

export type TrackSummary = {
  id: string;
  name: string;
  artists: ArtistSummary[];
  albumName: string;
  imageUrl: string | null;
  spotifyUrl: string | null;
  savedAt: string;
  popularity: number;
  audioFeatures: AudioFeatures;
};
