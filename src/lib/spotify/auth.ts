import type { JWT } from "next-auth/jwt";

import { refreshSpotifyToken } from "@/lib/spotify/sync/spotify-api";

import type { SpotifyTokenSet } from "@/lib/spotify/sync/types";

const REFRESH_WINDOW_SECONDS = 60;

export class SpotifySessionError extends Error {
  constructor(message = "Spotify is not connected") {
    super(message);
    this.name = "SpotifySessionError";
  }
}

export async function getUsableSpotifyTokens(token: JWT): Promise<SpotifyTokenSet> {
  if (!token.spotifyAccessToken) {
    throw new SpotifySessionError();
  }

  const tokens: SpotifyTokenSet = {
    accessToken: token.spotifyAccessToken,
    refreshToken: token.spotifyRefreshToken ?? null,
    expiresAt: token.spotifyExpiresAt ?? null
  };

  if (!shouldRefresh(tokens)) {
    return tokens;
  }

  return refreshTokenSet(tokens);
}

export async function refreshTokenSet(tokens: SpotifyTokenSet): Promise<SpotifyTokenSet> {
  if (!tokens.refreshToken) {
    throw new SpotifySessionError("Spotify needs to be reconnected");
  }

  return refreshSpotifyToken(tokens.refreshToken);
}

export function shouldRefresh(tokens: SpotifyTokenSet): boolean {
  if (!tokens.expiresAt) {
    return false;
  }

  return tokens.expiresAt <= Math.floor(Date.now() / 1000) + REFRESH_WINDOW_SECONDS;
}

