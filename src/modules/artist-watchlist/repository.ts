import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/db";

import type { Database } from "@/lib/db";
import type { NewRelease, WatchlistArtist } from "./types";

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>> | NonNullable<ReturnType<typeof createServiceSupabaseClient>>;
type AlbumRow = Database["public"]["Tables"]["albums"]["Row"];

async function getSupabase(): Promise<SupabaseClient | null> {
  return createServiceSupabaseClient() ?? (await createServerSupabaseClient());
}

export async function listWatchlist(userId: string): Promise<WatchlistArtist[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];

  const { data: watchRows, error } = await supabase
    .from("watchlist_artists")
    .select("artist_id,added_at,include_compilations")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) throw error;

  const artistIds = (watchRows ?? []).map((row) => row.artist_id);
  if (artistIds.length === 0) return [];

  const { data: artists, error: artistError } = await supabase.from("artists").select("id,name,image_url").in("id", artistIds);
  if (artistError) throw artistError;

  const artistById = new Map((artists ?? []).map((artist) => [artist.id, artist]));

  return (watchRows ?? []).map((row) => {
    const artist = artistById.get(row.artist_id);
    return {
      artistId: row.artist_id,
      name: artist?.name ?? row.artist_id,
      imageUrl: artist?.image_url ?? null,
      addedAt: row.added_at,
      includeCompilations: row.include_compilations
    };
  });
}

export async function addToWatchlist(userId: string, artistId: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from("watchlist_artists").upsert(
    {
      user_id: userId,
      artist_id: artistId,
      include_compilations: false
    },
    { onConflict: "user_id,artist_id" }
  );
  if (error) throw error;
}

export async function removeFromWatchlist(userId: string, artistId: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from("watchlist_artists").delete().eq("user_id", userId).eq("artist_id", artistId);
  if (error) throw error;
}

export async function setIncludeCompilations(userId: string, artistId: string, include: boolean): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { error } = await supabase
    .from("watchlist_artists")
    .update({ include_compilations: include })
    .eq("user_id", userId)
    .eq("artist_id", artistId);
  if (error) throw error;
}

export async function getRecentReleases(userId: string, opts: { sinceDays?: number; limit?: number } = {}): Promise<NewRelease[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];

  const sinceDays = opts.sinceDays ?? 14;
  const sinceDate = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
  const { data: releases, error } = await supabase
    .from("new_releases")
    .select("id,album_id,surfaced_at,dismissed_at,played_at")
    .eq("user_id", userId)
    .is("dismissed_at", null)
    .order("surfaced_at", { ascending: false })
    .limit(Math.max(opts.limit ?? 10, 50));
  if (error) throw error;

  const albumIds = (releases ?? []).map((release) => release.album_id);
  if (albumIds.length === 0) return [];

  const { data: albums, error: albumError } = await supabase
    .from("albums")
    .select("id,name,album_type,release_date,image_url,spotify_url,artist_ids")
    .in("id", albumIds);
  if (albumError) throw albumError;

  const albumById = new Map((albums ?? []).map((album) => [album.id, album as Pick<AlbumRow, "id" | "name" | "album_type" | "release_date" | "image_url" | "spotify_url" | "artist_ids">]));

  return (releases ?? []).flatMap((release) => {
    const album = albumById.get(release.album_id);
    if (!album || album.release_date < sinceDate) return [];

    return [
      {
        id: release.id,
        album: {
          id: album.id,
          name: album.name,
          type: album.album_type,
          releaseDate: album.release_date,
          imageUrl: album.image_url,
          spotifyUrl: album.spotify_url,
          artistIds: album.artist_ids
        },
        surfacedAt: release.surfaced_at,
        dismissed: Boolean(release.dismissed_at),
        played: Boolean(release.played_at)
      }
    ];
  }).slice(0, opts.limit ?? 10);
}

export async function dismissRelease(releaseId: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from("new_releases").update({ dismissed_at: new Date().toISOString() }).eq("id", releaseId);
  if (error) throw error;
}

export async function markReleasePlayed(releaseId: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from("new_releases").update({ played_at: new Date().toISOString() }).eq("id", releaseId);
  if (error) throw error;
}

export async function suggestWatchlistSeeds(userId: string, opts: { limit?: number } = {}): Promise<WatchlistArtist[]> {
  const supabase = await getSupabase();
  if (!supabase) return [];

  const { data: savedRows, error } = await supabase.from("saved_tracks").select("track_id,saved_at").eq("user_id", userId).is("removed_at", null);
  if (error) throw error;

  const trackIds = (savedRows ?? []).map((row) => row.track_id);
  if (trackIds.length === 0) return [];

  const { data: tracks, error: trackError } = await supabase.from("tracks").select("artist_ids").in("id", trackIds);
  if (trackError) throw trackError;

  const { data: watchRows, error: watchError } = await supabase.from("watchlist_artists").select("artist_id").eq("user_id", userId);
  if (watchError) throw watchError;

  const watchedIds = new Set((watchRows ?? []).map((row) => row.artist_id));
  const counts = new Map<string, number>();
  for (const track of tracks ?? []) {
    for (const artistId of track.artist_ids) {
      if (!watchedIds.has(artistId)) {
        counts.set(artistId, (counts.get(artistId) ?? 0) + 1);
      }
    }
  }

  const artistIds = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, opts.limit ?? 24)
    .map(([artistId]) => artistId);
  if (artistIds.length === 0) return [];

  const { data: artists, error: artistError } = await supabase.from("artists").select("id,name,image_url").in("id", artistIds);
  if (artistError) throw artistError;

  const artistById = new Map((artists ?? []).map((artist) => [artist.id, artist]));
  return artistIds.map((artistId) => {
    const artist = artistById.get(artistId);
    return {
      artistId,
      name: artist?.name ?? artistId,
      imageUrl: artist?.image_url ?? null,
      addedAt: new Date().toISOString(),
      includeCompilations: false
    };
  });
}
