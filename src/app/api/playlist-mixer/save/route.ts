import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env/server";
import { getUsableSpotifyTokens, refreshTokenSet, SpotifySessionError } from "@/lib/spotify/auth";
import { SpotifyApiError, spotifyFetch } from "@/lib/spotify/sync/spotify-api";

const PLAYLIST_SCOPE = "playlist-modify-private";
const LIKED_SCOPE = "user-library-modify";

const requestSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  trackIds: z.array(z.string().min(1)).min(1).max(100),
  saveAsPlaylist: z.boolean().optional(),
  addToLiked: z.boolean().optional(),
  coverImageBase64: z.string().max(350_000).optional()
});

type SpotifyProfile = {
  id: string;
};

type SpotifyPlaylistCreateResponse = {
  id: string;
  external_urls?: {
    spotify?: string;
  };
};

class SpotifySaveMixError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "SpotifySaveMixError";
  }
}

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET
  });

  if (!token) {
    return NextResponse.json({ error: "Spotify is not connected" }, { status: 401 });
  }

  const body = requestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid save request" }, { status: 400 });
  }

  if (!body.data.saveAsPlaylist && !body.data.addToLiked) {
    return NextResponse.json({ error: "Choose at least one save option" }, { status: 400 });
  }

  const missingScopes = getMissingScopes(token.spotifyScopes, body.data);
  if (missingScopes.length > 0) {
    return NextResponse.json(
      {
        error: "Spotify needs to be reconnected before Daily Spin can save playlists or Liked Songs.",
        requiredScopes: missingScopes
      },
      { status: 403 }
    );
  }

  try {
    let tokens = await getUsableSpotifyTokens(token);
    try {
      return await saveMix(tokens.accessToken, body.data);
    } catch (error) {
      if (error instanceof SpotifyApiError && error.status === 403) {
        throw new SpotifySaveMixError("Spotify needs to be reconnected before Daily Spin can save playlists or Liked Songs.", 403);
      }

      if (!(error instanceof SpotifyApiError) || error.status !== 401) {
        throw error;
      }

      tokens = await refreshTokenSet(tokens);
      return await saveMix(tokens.accessToken, body.data);
    }
  } catch (error) {
    console.error(error);
    if (error instanceof SpotifySessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof SpotifySaveMixError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    }

    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save playlist mix" }, { status: 500 });
  }
}

async function saveMix(accessToken: string, body: z.infer<typeof requestSchema>) {
  let playlist: SpotifyPlaylistCreateResponse | null = null;

  if (body.saveAsPlaylist) {
    const profile = await spotifyFetch<SpotifyProfile>(accessToken, "https://api.spotify.com/v1/me");
    playlist = await createPlaylist(accessToken, profile.id, body.title, body.description ?? "");

    await addTracksToPlaylist(accessToken, playlist.id, body.trackIds);

    if (body.coverImageBase64) {
      await uploadPlaylistCover(accessToken, playlist.id, body.coverImageBase64);
    }
  }

  if (body.addToLiked) {
    await addTracksToLikedSongs(accessToken, body.trackIds);
  }

  return NextResponse.json({
    playlist,
    likedCount: body.addToLiked ? body.trackIds.length : 0
  });
}

async function createPlaylist(accessToken: string, userId: string, title: string, description: string): Promise<SpotifyPlaylistCreateResponse> {
  const response = await fetch("https://api.spotify.com/v1/me/playlists", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      name: title,
      description,
      public: false
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw await createSpotifySaveMixError(response, "Spotify playlist create failed");
  }

  return (await response.json()) as SpotifyPlaylistCreateResponse;
}

async function addTracksToPlaylist(accessToken: string, playlistId: string, trackIds: string[]): Promise<void> {
  for (const chunk of chunkArray(trackIds, 100)) {
    await spotifyFetch(accessToken, `https://api.spotify.com/v1/playlists/${playlistId}/items`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        uris: chunk.map((id) => `spotify:track:${id}`)
      })
    });
  }
}

async function addTracksToLikedSongs(accessToken: string, trackIds: string[]): Promise<void> {
  for (const chunk of chunkArray(trackIds, 50)) {
    const params = new URLSearchParams({
      uris: chunk.map((id) => `spotify:track:${id}`).join(",")
    });
    const response = await fetch(`https://api.spotify.com/v1/me/library?${params.toString()}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw await createSpotifySaveMixError(response, "Spotify liked songs save failed");
    }
  }
}

async function uploadPlaylistCover(accessToken: string, playlistId: string, coverImageBase64: string): Promise<void> {
  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/images`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "image/jpeg"
    },
    body: coverImageBase64,
    cache: "no-store"
  });

  if (!response.ok) {
    throw await createSpotifySaveMixError(response, "Spotify playlist cover upload failed");
  }
}

function getMissingScopes(rawScopes: unknown, body: z.infer<typeof requestSchema>): string[] {
  const scopes = typeof rawScopes === "string" ? rawScopes.split(" ") : [];
  if (scopes.length === 0) {
    return [];
  }

  const requiredScopes = [
    body.saveAsPlaylist ? PLAYLIST_SCOPE : null,
    body.addToLiked ? LIKED_SCOPE : null
  ].filter((scope): scope is string => Boolean(scope));

  return requiredScopes.filter((scope) => !scopes.includes(scope));
}

async function createSpotifySaveMixError(response: Response, fallback: string): Promise<SpotifySaveMixError> {
  const details = await getSpotifyErrorDetails(response);
  const message = response.status === 403 ? "Spotify needs to be reconnected before Daily Spin can save playlists or Liked Songs." : `${fallback} (${response.status})`;

  return new SpotifySaveMixError(message, response.status, details);
}

async function getSpotifyErrorDetails(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
