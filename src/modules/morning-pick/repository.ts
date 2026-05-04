import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/db";
import { toIsoDate } from "@/lib/utils/date";

import type { MorningPick } from "./types";

type DailyPickRow = {
  id: string;
  track_id: string;
  pick_date: string;
  reason: string;
  score_breakdown: MorningPick["scoreBreakdown"];
  dismissed: boolean;
  played: boolean;
};

export async function getTodayPick(userId: string): Promise<MorningPick | null> {
  const supabase = createServiceSupabaseClient() ?? (await createServerSupabaseClient());
  const pickDate = toIsoDate(new Date());

  if (supabase) {
    const { data, error } = await supabase
      .from("daily_picks")
      .select("id, track_id, pick_date, reason, score_breakdown, dismissed, played")
      .eq("user_id", userId)
      .eq("pick_date", pickDate)
      .eq("dismissed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST205") {
        return null;
      }

      throw error;
    }

    const row = data as DailyPickRow | null;

    if (row) {
      const { data: track } = await supabase.from("tracks").select("name,artist_ids,album_id,spotify_url").eq("id", row.track_id).maybeSingle();
      const artistIds = track?.artist_ids ?? [];
      const [{ data: artists }, { data: album }] = await Promise.all([
        artistIds.length > 0 ? supabase.from("artists").select("id,name").in("id", artistIds) : Promise.resolve({ data: [] }),
        track?.album_id ? supabase.from("albums").select("name,image_url").eq("id", track.album_id).maybeSingle() : Promise.resolve({ data: null })
      ]);
      const artistNameById = new Map((artists ?? []).map((artist) => [artist.id, artist.name]));

      return {
        id: row.id,
        trackId: row.track_id,
        trackName: track?.name ?? null,
        artists: artistIds.map((id) => artistNameById.get(id) ?? id),
        albumName: album?.name ?? null,
        imageUrl: album?.image_url ?? null,
        spotifyUrl: track?.spotify_url ?? null,
        pickDate: row.pick_date,
        reason: row.reason,
        scoreBreakdown: row.score_breakdown,
        dismissed: row.dismissed,
        played: row.played
      };
    }
  }

  return null;
}

export async function regenerateTodayPick(_userId: string): Promise<MorningPick> {
  throw new Error("Morning Pick regeneration needs a synced Spotify library");
}

export async function markPlayed(_pickId: string): Promise<void> {
  return;
}

export async function markDismissed(_pickId: string): Promise<void> {
  return;
}

export async function explainPick(_pickId: string): Promise<string> {
  return "This pick was selected from saved tracks you have not returned to lately.";
}
