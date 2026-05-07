export type PlaylistMixSourceKind = "liked" | "playlist";

export type PlaylistMixSource = {
  id: string;
  name: string;
  kind: PlaylistMixSourceKind;
  trackCount: number;
};

export type PlaylistMixTrack = {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  albumName: string;
  imageUrl: string | null;
  spotifyUrl: string | null;
  popularity: number;
  source: "library" | "spotify";
  audioFeatures: {
    energy: number;
    valence: number;
    tempo: number;
    danceability: number;
    acousticness: number;
    instrumentalness: number;
    liveness: number;
    speechiness: number;
  } | null;
};

export type GeneratedPlaylistMix = {
  title: string;
  description: string;
  source: PlaylistMixSource;
  tracks: Array<
    PlaylistMixTrack & {
      reason: string;
    }
  >;
};
