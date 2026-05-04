import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET
  });

  if (!token?.spotifyAccessToken) {
    return NextResponse.json({ error: "Spotify is not connected" }, { status: 401 });
  }

  const body = (await request.json()) as { deviceId?: string; uri?: string; uris?: string[]; offset?: number };

  const uris = body.uris && body.uris.length > 0 ? body.uris : body.uri ? [body.uri] : [];

  if (!body.deviceId || uris.length === 0) {
    return NextResponse.json({ error: "deviceId and uri or uris are required" }, { status: 400 });
  }

  const transferResponse = await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token.spotifyAccessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      device_ids: [body.deviceId],
      play: false
    })
  });

  if (!transferResponse.ok && transferResponse.status !== 404) {
    return NextResponse.json(
      {
        error: "Spotify device transfer failed",
        status: transferResponse.status,
        details: await getSpotifyErrorDetails(transferResponse)
      },
      { status: transferResponse.status }
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 700));

  let response = await playTrack(token.spotifyAccessToken, body.deviceId, uris, body.offset ?? 0);

  if (response.status === 404) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    response = await playTrack(token.spotifyAccessToken, body.deviceId, uris, body.offset ?? 0);
  }

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "Spotify playback failed",
        status: response.status,
        details: await getSpotifyErrorDetails(response)
      },
      { status: response.status }
    );
  }

  return NextResponse.json({ ok: true });
}

async function playTrack(accessToken: unknown, deviceId: string, uris: string[], offset: number): Promise<Response> {
  return fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${String(accessToken)}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      uris,
      offset: {
        position: Math.min(Math.max(0, offset), uris.length - 1)
      }
    })
  });
}

async function getSpotifyErrorDetails(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
}
