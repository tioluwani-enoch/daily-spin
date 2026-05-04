import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET
  });

  if (!token?.spotifyAccessToken) {
    return NextResponse.json({ error: "Spotify is not connected" }, { status: 401 });
  }

  return NextResponse.json({
    accessToken: token.spotifyAccessToken
  });
}
