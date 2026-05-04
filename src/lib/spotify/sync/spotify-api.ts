import { getServerEnv } from "@/lib/env/server";

import type { SpotifyTokenSet } from "./types";

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

type SpotifyPage<T> = {
  items: T[];
  next: string | null;
};

export async function spotifyFetch<T>(accessToken: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new SpotifyApiError(`Spotify request failed: ${url}`, response.status);
  }

  return (await response.json()) as T;
}

export async function getAllSpotifyPages<T>(accessToken: string, firstUrl: string): Promise<T[]> {
  const items: T[] = [];
  let nextUrl: string | null = firstUrl;

  while (nextUrl) {
    const page: SpotifyPage<T> = await spotifyFetch(accessToken, nextUrl);
    items.push(...page.items);
    nextUrl = page.next;
  }

  return items;
}

export async function refreshSpotifyToken(refreshToken: string): Promise<SpotifyTokenSet> {
  const env = getServerEnv();

  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    throw new Error("Spotify client credentials are missing");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    throw new SpotifyApiError("Spotify token refresh failed", response.status);
  }

  const payload = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + payload.expires_in
  };
}
