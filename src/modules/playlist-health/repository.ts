import { createServiceSupabaseClient } from "@/lib/db";

import type { PlaylistHealth, Suggestion } from "./types";
import type { Fingerprint, HealthLabel } from "./types";

export async function getHealth(playlistId: string): Promise<PlaylistHealth> {
  const health = (await listAllHealth("")).find((item) => item.playlistId === playlistId);
  if (!health) {
    throw new Error("Playlist health needs synced Spotify playlists");
  }
  return health;
}

export async function listAllHealth(userId: string): Promise<PlaylistHealth[]> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return [];
  }

  const query = supabase.from("playlists").select("id,name,track_count,last_modified_at,last_played_at");

  const { data: playlists, error } = userId ? await query.eq("user_id", userId) : await query;
  if (error) {
    return [];
  }

  const playlistIds = (playlists ?? []).map((playlist) => playlist.id);
  if (playlistIds.length === 0) {
    return [];
  }

  const { data: fingerprints, error: fingerprintError } = await supabase
    .from("playlist_fingerprints")
    .select("playlist_id,core_centroid,recent_centroid,drift_score,health_label,computed_at")
    .in("playlist_id", playlistIds);

  if (fingerprintError) {
    return [];
  }

  const fingerprintByPlaylistId = new Map((fingerprints ?? []).map((fingerprint) => [fingerprint.playlist_id, fingerprint]));

  return (playlists ?? [])
    .map((row) => {
      const fingerprint = fingerprintByPlaylistId.get(row.id);

      if (!fingerprint) {
        return null;
      }

      return {
        playlistId: row.id,
        name: row.name,
        trackCount: row.track_count,
        coreCentroid: fingerprint.core_centroid as Fingerprint,
        recentCentroid: fingerprint.recent_centroid as Fingerprint,
        driftScore: fingerprint.drift_score,
        daysSinceLastEdit: daysSince(row.last_modified_at),
        daysSinceLastPlay: row.last_played_at ? daysSince(row.last_played_at) : null,
        healthLabel: fingerprint.health_label as HealthLabel,
        computedAt: fingerprint.computed_at
      };
    })
    .filter((item): item is PlaylistHealth => Boolean(item))
    .sort((a, b) => {
      const order = { drifting: 0, stale: 1, dying: 2, healthy: 3 };
      return order[a.healthLabel] - order[b.healthLabel] || b.driftScore - a.driftScore;
    });
}

export async function recompute(playlistId: string): Promise<PlaylistHealth> {
  return getHealth(playlistId);
}

export async function proposeAdditions(_playlistId: string, opts: { limit?: number; pool?: "library" | "watchlist" | "both" } = {}): Promise<Suggestion[]> {
  void opts;
  return [];
}

export async function proposeRemovals(_playlistId: string, opts: { limit?: number } = {}): Promise<Suggestion[]> {
  void opts;
  return [];
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
