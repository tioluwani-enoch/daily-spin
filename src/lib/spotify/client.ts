export class SpotifyAuthError extends Error {
  constructor(message = "Spotify authentication is required") {
    super(message);
    this.name = "SpotifyAuthError";
  }
}

export async function addTrackToPlaylist(_userId: string, _playlistId: string, _trackId: string): Promise<void> {
  throw new SpotifyAuthError();
}

export async function saveTrackToLibrary(_userId: string, _trackId: string): Promise<void> {
  throw new SpotifyAuthError();
}
