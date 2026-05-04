import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";

const REQUIRED_WEB_PLAYBACK_SCOPES = ["streaming", "user-read-email", "user-read-private"];

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET
  });

  if (!token?.spotifyAccessToken) {
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

  return NextResponse.json({
    accessToken: token.spotifyAccessToken
  });
}
