import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import { backfillSpotifyUser } from "@/lib/spotify/sync/backfill";

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET
  });

  if (!token?.spotifyAccessToken) {
    return NextResponse.json({ error: "Spotify is not connected" }, { status: 401 });
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required for backfill" }, { status: 500 });
  }

  try {
    const result = await backfillSpotifyUser({
      accessToken: token.spotifyAccessToken,
      refreshToken: token.spotifyRefreshToken ?? null,
      expiresAt: token.spotifyExpiresAt ?? null
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Spotify backfill failed"
      },
      { status: 500 }
    );
  }
}
