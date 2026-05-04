import { NextResponse } from "next/server";

import { getCurrentDailySpinUserId } from "@/lib/auth/user";
import { addToWatchlist, listWatchlist, removeFromWatchlist, setIncludeCompilations, suggestWatchlistSeeds } from "@/modules/artist-watchlist";

export async function GET() {
  const userId = await getCurrentDailySpinUserId();
  const [watchlist, seeds] = await Promise.all([listWatchlist(userId), suggestWatchlistSeeds(userId)]);

  return NextResponse.json({ watchlist, seeds });
}

export async function POST(request: Request) {
  const userId = await getCurrentDailySpinUserId();
  const body = (await request.json()) as { artistId?: string; includeCompilations?: boolean };

  if (!body.artistId) {
    return NextResponse.json({ error: "artistId is required" }, { status: 400 });
  }

  await addToWatchlist(userId, body.artistId);
  if (typeof body.includeCompilations === "boolean") {
    await setIncludeCompilations(userId, body.artistId, body.includeCompilations);
  }

  const [watchlist, seeds] = await Promise.all([listWatchlist(userId), suggestWatchlistSeeds(userId)]);
  return NextResponse.json({ watchlist, seeds });
}

export async function PATCH(request: Request) {
  const userId = await getCurrentDailySpinUserId();
  const body = (await request.json()) as { artistId?: string; includeCompilations?: boolean };

  if (!body.artistId || typeof body.includeCompilations !== "boolean") {
    return NextResponse.json({ error: "artistId and includeCompilations are required" }, { status: 400 });
  }

  await setIncludeCompilations(userId, body.artistId, body.includeCompilations);
  const [watchlist, seeds] = await Promise.all([listWatchlist(userId), suggestWatchlistSeeds(userId)]);
  return NextResponse.json({ watchlist, seeds });
}

export async function DELETE(request: Request) {
  const userId = await getCurrentDailySpinUserId();
  const body = (await request.json()) as { artistId?: string };

  if (!body.artistId) {
    return NextResponse.json({ error: "artistId is required" }, { status: 400 });
  }

  await removeFromWatchlist(userId, body.artistId);
  const [watchlist, seeds] = await Promise.all([listWatchlist(userId), suggestWatchlistSeeds(userId)]);
  return NextResponse.json({ watchlist, seeds });
}
