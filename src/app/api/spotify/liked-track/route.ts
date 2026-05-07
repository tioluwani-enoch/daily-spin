import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env/server";
import { getUsableSpotifyTokens, refreshTokenSet, SpotifySessionError } from "@/lib/spotify/auth";
import { SpotifyApiError } from "@/lib/spotify/sync/spotify-api";

const requestSchema = z.object({
  trackId: z.string().min(1)
});

export async function PUT(request: NextRequest) {
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
    return NextResponse.json({ error: "trackId is required" }, { status: 400 });
  }

  try {
    let tokens = await getUsableSpotifyTokens(token);
    try {
      await saveTrackToLikedSongs(tokens.accessToken, body.data.trackId);
    } catch (error) {
      if (!(error instanceof SpotifyApiError) || error.status !== 401) {
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

    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not add this track to Liked Songs" }, { status: 500 });
  }
}

async function saveTrackToLikedSongs(accessToken: string, trackId: string): Promise<void> {
  const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${encodeURIComponent(trackId)}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new SpotifyApiError("Spotify liked song save failed", response.status);
  }
}
