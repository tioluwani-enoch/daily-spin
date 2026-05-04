export type WatchlistArtist = {
  artistId: string;
  name: string;
  imageUrl: string | null;
  addedAt: string;
  includeCompilations: boolean;
};

export type NewRelease = {
  id: string;
  album: {
    id: string;
    name: string;
    type: "album" | "single" | "compilation";
    releaseDate: string;
    imageUrl: string | null;
    artistIds: string[];
  };
  surfacedAt: string;
  dismissed: boolean;
  played: boolean;
};
