import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import { getUsableSpotifyTokens, SpotifySessionError } from "@/lib/spotify/auth";

const REQUIRED_WEB_PLAYBACK_SCOPES = ["streaming", "user-read-email", "user-read-private"];

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET
  });

  if (!token) {
    return NextResponse.json({ error: "Spotify is not connected" }, { status: 401 });
  }

  const scopes = typeof token.spotifyScopes === "string" ? token.spotifyScopes.split(" ") : [];
  const missingScopes = REQUIRED_WEB_PLAYBACK_SCOPES.filter((scope) => !scopes.includes(scope));

  if (missingScopes.length > 0) {
    return NextResponse.json(
      {
        error: `Spotify needs fresh consent for in-app playback. Missing: ${missingScopes.join(", ")}. Disconnect and connect Spotify again.`
      },
      { status: 403 }
    );
  }

  try {
    const tokens = await getUsableSpotifyTokens(token);
    return NextResponse.json({
      accessToken: tokens.accessToken
    });
  } catch (error) {
    if (error instanceof SpotifySessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    throw error;
  }
}
