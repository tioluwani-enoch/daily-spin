import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";
import { getUsableSpotifyTokens, refreshTokenSet, SpotifySessionError } from "@/lib/spotify/auth";

export async function POST(request: NextRequest) {
  const env = getServerEnv();
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET
  });

  if (!token) {
    return NextResponse.json({ error: "Spotify is not connected" }, { status: 401 });
  }

  const body = (await request.json()) as {
    deviceId?: string;
    uri?: string;
    uris?: string[];
    offset?: number;
    positionMs?: number;
    transfer?: boolean;
  };

  const uris = body.uris && body.uris.length > 0 ? body.uris : body.uri ? [body.uri] : [];

  if (!body.deviceId || uris.length === 0) {
    return NextResponse.json({ error: "deviceId and uri or uris are required" }, { status: 400 });
  }

  let tokens;
  try {
    tokens = await getUsableSpotifyTokens(token);
  } catch (error) {
    if (error instanceof SpotifySessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    throw error;
  }

  let transferResponse: Response | null = null;
  if (body.transfer !== false) {
    transferResponse = await transferPlayback(tokens.accessToken, body.deviceId);
  }

  if (transferResponse?.status === 401) {
    try {
      tokens = await refreshTokenSet(tokens);
      transferResponse = await transferPlayback(tokens.accessToken, body.deviceId);
    } catch (error) {
      if (error instanceof SpotifySessionError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      throw error;
    }
  }

  if (transferResponse && !transferResponse.ok && transferResponse.status !== 404) {
    return NextResponse.json(
      {
        error: "Spotify device transfer failed",
        status: transferResponse.status,
        details: await getSpotifyErrorDetails(transferResponse)
      },
      { status: transferResponse.status }
    );
  }

  if (transferResponse) {
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  let response = await playTrack(tokens.accessToken, body.deviceId, uris, body.offset ?? 0, body.positionMs);

  if (response.status === 401) {
    try {
      tokens = await refreshTokenSet(tokens);
      response = await playTrack(tokens.accessToken, body.deviceId, uris, body.offset ?? 0, body.positionMs);
    } catch (error) {
      if (error instanceof SpotifySessionError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      throw error;
    }
  }

  if (response.status === 404) {
    await transferPlayback(tokens.accessToken, body.deviceId);
    await new Promise((resolve) => setTimeout(resolve, 700));
    response = await playTrack(tokens.accessToken, body.deviceId, uris, body.offset ?? 0, body.positionMs);
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

function transferPlayback(accessToken: string, deviceId: string): Promise<Response> {
  return fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false
    })
  });
}

async function playTrack(accessToken: unknown, deviceId: string, uris: string[], offset: number, positionMs?: number): Promise<Response> {
  const body: {
    uris: string[];
    offset: {
      position: number;
    };
    position_ms?: number;
  } = {
    uris,
    offset: {
      position: Math.min(Math.max(0, offset), uris.length - 1)
    }
  };

  if (typeof positionMs === "number" && positionMs > 0) {
    body.position_ms = Math.floor(positionMs);
  }

  return fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${String(accessToken)}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function getSpotifyErrorDetails(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
}
