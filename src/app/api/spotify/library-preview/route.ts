import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getServerEnv } from "@/lib/env/server";

type SpotifySavedTrackResponse = {
  items: Array<{
    added_at: string;
    track: {
      id: string;
      name: string;
      external_urls: {
        spotify: string;
      };
      artists: Array<{
        name: string;
      }>;
      album: {
        name: string;
        images: Array<{
          url: string;
        }>;
      };
    };
  }>;
};

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET
  });

  if (!token?.spotifyAccessToken) {
    return NextResponse.json({ error: "Spotify is not connected" }, { status: 401 });
  }

  const response = await fetch("https://api.spotify.com/v1/me/tracks?limit=20", {
    headers: {
      authorization: `Bearer ${token.spotifyAccessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        error: "Spotify library preview failed",
        status: response.status
      },
      { status: response.status }
    );
  }

  const data = (await response.json()) as SpotifySavedTrackResponse;

  return NextResponse.json({
    tracks: data.items.map((item) => ({
      id: item.track.id,
      uri: `spotify:track:${item.track.id}`,
      name: item.track.name,
      artists: item.track.artists.map((artist) => artist.name),
      album: item.track.album.name,
      imageUrl: item.track.album.images[0]?.url ?? null,
      spotifyUrl: item.track.external_urls.spotify,
      savedAt: item.added_at
    }))
  });
}
