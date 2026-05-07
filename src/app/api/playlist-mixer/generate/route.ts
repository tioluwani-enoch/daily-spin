import { NextResponse } from "next/server";
import { z } from "zod";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

import { getCurrentDailySpinUserId } from "@/lib/auth/user";
import { getServerEnv } from "@/lib/env/server";
import { getUsableSpotifyTokens, SpotifySessionError } from "@/lib/spotify/auth";
import { generatePlaylistMix, getLikedTracksForMixContext, getPlaylistMixSource, getTracksForMixSource } from "@/modules/playlist-mixer";

const requestSchema = z.object({
  sourceId: z.string().min(1),
  goal: z.string().trim().max(240).optional(),
  targetCount: z.number().int().min(5).max(40).optional()
});

export async function POST(request: NextRequest) {
  const body = requestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid playlist mix request" }, { status: 400 });
  }

  const env = getServerEnv();
  const token = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET
  });

  let accessToken: string | undefined;
  if (token) {
    try {
      const tokens = await getUsableSpotifyTokens(token);
      accessToken = tokens.accessToken;
    } catch (error) {
      if (!(error instanceof SpotifySessionError)) {
        throw error;
      }
    }
  }

  const userId = await getCurrentDailySpinUserId();
  const source = await getPlaylistMixSource(userId, body.data.sourceId);
  if (!source) {
    return NextResponse.json({ error: "Choose a synced playlist source first" }, { status: 404 });
  }

  const [sourceTracks, likedTracks] = await Promise.all([
    getTracksForMixSource(userId, source.id),
    source.id === "liked" ? Promise.resolve([]) : getLikedTracksForMixContext(userId)
  ]);

  if (sourceTracks.length === 0) {
    return NextResponse.json({ error: "This source does not have synced tracks yet" }, { status: 422 });
  }

  const mix = await generatePlaylistMix({
    source,
    sourceTracks,
    likedTracks,
    goal: body.data.goal || "Make a fresh playlist that still feels like my taste.",
    targetCount: body.data.targetCount ?? 20,
    accessToken
  });

  return NextResponse.json({ mix });
}
