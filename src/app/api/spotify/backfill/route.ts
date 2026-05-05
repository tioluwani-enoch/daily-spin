import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import { getUsableSpotifyTokens, refreshTokenSet, SpotifySessionError } from "@/lib/spotify/auth";
import { backfillSpotifyUser } from "@/lib/spotify/sync/backfill";
import { SpotifyApiError } from "@/lib/spotify/sync/spotify-api";

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET
  });

  if (!token) {
    return NextResponse.json({ error: "Spotify is not connected" }, { status: 401 });
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required for backfill" }, { status: 500 });
  }

  try {
    let tokens = await getUsableSpotifyTokens(token);
    let result;

    try {
      result = await backfillSpotifyUser(tokens);
    } catch (error) {
      if (!(error instanceof SpotifyApiError) || error.status !== 401) {
        throw error;
      }

      tokens = await refreshTokenSet(tokens);
      result = await backfillSpotifyUser(tokens);
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error(error);
    if (error instanceof SpotifySessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Spotify backfill failed"
      },
      { status: 500 }
    );
  }
}
