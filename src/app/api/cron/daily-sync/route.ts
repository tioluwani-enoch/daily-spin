import { NextResponse } from "next/server";

import { createServiceSupabaseClient } from "@/lib/db";
import { getServerEnv } from "@/lib/env/server";
import { backfillSpotifyUser } from "@/lib/spotify/sync/backfill";
import { refreshSpotifyToken } from "@/lib/spotify/sync/spotify-api";

export async function GET(request: Request) {
  const env = getServerEnv();
  const secret = request.headers.get("x-cron-secret");

  if (env.CRON_SECRET && secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required for cron sync" }, { status: 500 });
  }

  const { data: accounts, error } = await supabase.from("spotify_accounts").select("user_id,refresh_token");
  if (error) {
    throw error;
  }

  const results = [];
  for (const account of accounts ?? []) {
    const refreshed = await refreshSpotifyToken(account.refresh_token);
    const result = await backfillSpotifyUser(refreshed);
    results.push({ accountUserId: account.user_id, ...result });
  }

  return NextResponse.json({
    ok: true,
    syncedUsers: results.length,
    results
  });
}
