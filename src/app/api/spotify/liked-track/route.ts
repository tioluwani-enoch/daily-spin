import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env/server";
import { getUsableSpotifyTokens, refreshTokenSet, SpotifySessionError } from "@/lib/spotify/auth";

const REQUIRED_SCOPE = "user-library-modify";

const requestSchema = z.object({
  trackId: z.string().min(1)
});

class SpotifyLikedSongError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "SpotifyLikedSongError";
  }
}

export async function PUT(request: NextRequest) {
  const env = getServerEnv();
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET
  });

  if (!token) {
    return NextResponse.json({ error: "Spotify is not connected" }, { status: 401 });
  }

  const scopes = typeof token.spotifyScopes === "string" ? token.spotifyScopes.split(" ") : [];
  if (scopes.length > 0 && !scopes.includes(REQUIRED_SCOPE)) {
    return NextResponse.json(
      {
        error: "Spotify needs to be reconnected before Daily Spin can add Liked Songs.",
        requiredScope: REQUIRED_SCOPE
      },
      { status: 403 }
    );
  }

  const body = requestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  try {
    let tokens = await getUsableSpotifyTokens(token);
    try {
      await saveTrackToLikedSongs(tokens.accessToken, body.data.trackId);
    } catch (error) {
      if (!(error instanceof SpotifyLikedSongError) || error.status !== 401) {
        throw error;
      }

      tokens = await refreshTokenSet(tokens);
      await saveTrackToLikedSongs(tokens.accessToken, body.data.trackId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    if (error instanceof SpotifySessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof SpotifyLikedSongError) {
      return NextResponse.json({ error: error.message, requiredScope: error.status === 403 ? REQUIRED_SCOPE : undefined, details: error.details }, { status: error.status });
    }

    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add this track to Liked Songs" }, { status: 500 });
  }
}

async function saveTrackToLikedSongs(accessToken: string, trackId: string): Promise<void> {
  const params = new URLSearchParams({
    uris: `spotify:track:${trackId}`
  });
  const response = await fetch(`https://api.spotify.com/v1/me/library?${params.toString()}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await getSpotifyErrorDetails(response);

    throw new SpotifyLikedSongError(
      response.status === 403 ? "Spotify needs to be reconnected before Daily Spin can add Liked Songs." : `Spotify liked song save failed (${response.status})`,
      response.status,
      details
    );
  }
}

async function getSpotifyErrorDetails(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
}
