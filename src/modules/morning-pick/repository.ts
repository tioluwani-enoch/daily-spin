import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/db";
import { toIsoDate } from "@/lib/utils/date";

import type { MorningPick } from "./types";
import type { Json } from "@/lib/db";

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
      return hydratePick(supabase, row);
    }
  }

  return null;
}

export async function regenerateTodayPick(userId: string, dismissedPickId?: string): Promise<MorningPick> {
  const supabase = createServiceSupabaseClient() ?? (await createServerSupabaseClient());

  if (!supabase) {
    throw new Error("Supabase is required to regenerate Morning Pick");
  }

  const pickDate = toIsoDate(new Date());

  if (dismissedPickId) {
    await markDismissed(dismissedPickId);
  }

  const { data: savedRows, error } = await supabase
    .from("saved_tracks")
    .select("track_id,saved_at")
    .eq("user_id", userId)
    .is("removed_at", null);
  if (error) throw error;

  if (!savedRows || savedRows.length === 0) {
    throw new Error("Run Spotify backfill before randomizing Morning Pick");
  }

  const { data: todaysPicks, error: picksError } = await supabase
    .from("daily_picks")
    .select("track_id")
    .eq("user_id", userId)
    .eq("pick_date", pickDate);
  if (picksError) throw picksError;

  const usedToday = new Set((todaysPicks ?? []).map((pick) => pick.track_id));
  const available = savedRows.filter((row) => !usedToday.has(row.track_id));
  const pool = available.length > 0 ? available : savedRows;
  const selected = pool[Math.floor(Math.random() * pool.length)];

  const reason =
    available.length > 0
      ? "Here is a fresh recommendation from your synced Spotify library. Daily Spin is randomizing today's pick so your bigger library gets more room to breathe."
      : "You have rotated through today's available picks, so Daily Spin is reshuffling your synced Spotify library.";

  const { data: inserted, error: insertError } = await supabase
    .from("daily_picks")
    .upsert(
      {
        user_id: userId,
        pick_date: pickDate,
        track_id: selected.track_id,
        reason,
        dismissed: false,
        played: false,
        score_breakdown: {
          recencyOfSave: 0,
          underplay: 0,
          affinity: 0,
          novelty: 1,
          composite: 0
        } satisfies Json
      },
      { onConflict: "user_id,pick_date,track_id" }
    )
    .select("id, track_id, pick_date, reason, score_breakdown, dismissed, played")
    .single();
  if (insertError) throw insertError;

  return hydratePick(supabase, inserted as DailyPickRow);
}

export async function markPlayed(pickId: string): Promise<void> {
  const supabase = createServiceSupabaseClient() ?? (await createServerSupabaseClient());
  if (!supabase || !pickId) return;

  const { error } = await supabase.from("daily_picks").update({ played: true }).eq("id", pickId);
  if (error) throw error;
}

export async function markDismissed(pickId: string): Promise<void> {
  const supabase = createServiceSupabaseClient() ?? (await createServerSupabaseClient());
  if (!supabase || !pickId) return;

  const { error } = await supabase.from("daily_picks").update({ dismissed: true }).eq("id", pickId);
  if (error) throw error;
}

export async function explainPick(_pickId: string): Promise<string> {
  return "This pick was selected from saved tracks you have not returned to lately.";
}

async function hydratePick(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>> | NonNullable<ReturnType<typeof createServiceSupabaseClient>>,
  row: DailyPickRow
): Promise<MorningPick> {
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
