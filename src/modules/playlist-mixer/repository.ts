import { createServiceSupabaseClient } from "@/lib/db";

import type { Database } from "@/lib/db";
import type { PlaylistMixSource, PlaylistMixTrack } from "./types";

type TrackRow = Database["public"]["Tables"]["tracks"]["Row"];
type AlbumRow = Database["public"]["Tables"]["albums"]["Row"];
type ArtistRow = Database["public"]["Tables"]["artists"]["Row"];

const LIKED_SOURCE_ID = "liked";

export async function listPlaylistMixSources(userId: string): Promise<PlaylistMixSource[]> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return [];
  }

  const [{ count: likedCount }, { data: playlists }] = await Promise.all([
    supabase.from("saved_tracks").select("track_id", { count: "exact", head: true }).eq("user_id", userId).is("removed_at", null),
    supabase.from("playlists").select("id,name,track_count").eq("user_id", userId).order("name", { ascending: true })
  ]);

  return [
    {
      id: LIKED_SOURCE_ID,
      name: "Liked Songs",
      kind: "liked" as const,
      trackCount: likedCount ?? 0
    },
    ...(playlists ?? []).map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      kind: "playlist" as const,
      trackCount: playlist.track_count
    }))
  ].filter((source) => source.trackCount > 0);
}

export async function getPlaylistMixSource(userId: string, sourceId: string): Promise<PlaylistMixSource | null> {
  const sources = await listPlaylistMixSources(userId);
  return sources.find((source) => source.id === sourceId) ?? null;
}

export async function getTracksForMixSource(userId: string, sourceId: string, limit = 160): Promise<PlaylistMixTrack[]> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    return [];
  }

  if (sourceId === LIKED_SOURCE_ID) {
    const { data } = await supabase
      .from("saved_tracks")
      .select("track_id,saved_at")
      .eq("user_id", userId)
      .is("removed_at", null)
      .order("saved_at", { ascending: false })
      .limit(limit);

    return hydrateTracks((data ?? []).map((row) => row.track_id));
  }

  const { data: playlist } = await supabase.from("playlists").select("id").eq("id", sourceId).eq("user_id", userId).maybeSingle();
  if (!playlist) {
    return [];
  }

  const { data } = await supabase
    .from("playlist_tracks")
    .select("track_id,position")
    .eq("playlist_id", sourceId)
    .order("position", { ascending: true })
    .limit(limit);

  return hydrateTracks((data ?? []).map((row) => row.track_id));
}

export async function getLikedTracksForMixContext(userId: string, limit = 120): Promise<PlaylistMixTrack[]> {
  return getTracksForMixSource(userId, LIKED_SOURCE_ID, limit);
}

async function hydrateTracks(trackIds: string[]): Promise<PlaylistMixTrack[]> {
  const supabase = createServiceSupabaseClient();
  if (!supabase || trackIds.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(trackIds)];
  const { data: tracks } = await supabase.from("tracks").select("*").in("id", uniqueIds);
  const trackById = new Map((tracks ?? []).map((track) => [track.id, track as TrackRow]));
  const orderedTracks = uniqueIds.map((id) => trackById.get(id)).filter((track): track is TrackRow => Boolean(track));

  const albumIds = [...new Set(orderedTracks.map((track) => track.album_id).filter((id): id is string => Boolean(id)))];
  const artistIds = [...new Set(orderedTracks.flatMap((track) => track.artist_ids ?? []))];

  const [{ data: albums }, { data: artists }] = await Promise.all([
    albumIds.length > 0 ? supabase.from("albums").select("*").in("id", albumIds) : Promise.resolve({ data: [] as AlbumRow[] }),
    artistIds.length > 0 ? supabase.from("artists").select("*").in("id", artistIds) : Promise.resolve({ data: [] as ArtistRow[] })
  ]);

  const albumById = new Map((albums ?? []).map((album) => [album.id, album as AlbumRow]));
  const artistById = new Map((artists ?? []).map((artist) => [artist.id, artist as ArtistRow]));

  return orderedTracks.map((track) => {
    const album = track.album_id ? albumById.get(track.album_id) : null;
    return {
      id: track.id,
      uri: `spotify:track:${track.id}`,
      name: track.name,
      artists: (track.artist_ids ?? []).map((id) => artistById.get(id)?.name ?? id),
      albumName: album?.name ?? "",
      imageUrl: album?.image_url ?? null,
      spotifyUrl: track.spotify_url,
      popularity: track.popularity,
      source: "library",
      audioFeatures: track.audio_features
    };
  });
}
