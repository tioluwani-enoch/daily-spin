import type { AudioFeatures } from "@/lib/db";

export type SpotifyTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
};

export type SpotifySyncResult = {
  userId: string;
  spotifyId: string;
  savedTracks: number;
  listeningHistory: number;
  playlists: number;
  playlistTracks: number;
  skippedPlaylists: number;
  audioFeatures: {
    requested: number;
    stored: number;
    unavailable: boolean;
    status: number | null;
  };
  morningPickComputed: boolean;
};

export type SpotifyImage = {
  url: string;
};

export type SpotifyArtist = {
  id: string;
  name: string;
  genres?: string[];
  images?: SpotifyImage[];
};

export type SpotifyAlbum = {
  id: string;
  name: string;
  album_type: "album" | "single" | "compilation" | null;
  release_date: string | null;
  release_date_precision: "year" | "month" | "day" | null;
  images: SpotifyImage[] | null;
  artists: SpotifyArtist[];
  external_urls?: {
    spotify?: string;
  };
};

export type SpotifyTrack = {
  id: string | null;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number | null;
  explicit: boolean | null;
  popularity: number | null;
  external_urls?: {
    spotify?: string;
  };
  is_local?: boolean;
};

export type SpotifyAudioFeatures = AudioFeatures & {
  id: string;
};
