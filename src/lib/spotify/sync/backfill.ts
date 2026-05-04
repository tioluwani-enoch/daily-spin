import { createServiceSupabaseClient } from "@/lib/db";
import { getDailySpinUserId } from "@/lib/auth/user";
import { toIsoDate } from "@/lib/utils/date";
import { chooseMorningPick, featureVector, meanVector } from "@/modules/morning-pick/algorithm";
import { getHealthLabel } from "@/modules/playlist-health/drift";
import { getFingerprintDistance, meanFingerprint, normalizeFeatures } from "@/modules/playlist-health/fingerprint";

import { getAllSpotifyPages, SpotifyApiError, spotifyFetch } from "./spotify-api";

import type { AudioFeatures, Json } from "@/lib/db";
import type { PickCandidate } from "@/modules/morning-pick/algorithm";
import type { Fingerprint, HealthLabel } from "@/modules/playlist-health";
import type {
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyAudioFeatures,
  SpotifySyncResult,
  SpotifyTokenSet,
  SpotifyTrack
} from "./types";

type SpotifyProfile = {
  id: string;
  display_name: string | null;
  email: string | null;
  country: string | null;
};

type SavedTrackItem = {
  added_at: string;
  track: SpotifyTrack;
};

type RecentlyPlayedItem = {
  played_at: string;
  context: { uri: string } | null;
  track: SpotifyTrack;
};

type PlaylistItem = {
  id: string;
  name: string;
  description: string | null;
  owner: { id: string } | null;
  tracks?: { total?: number } | null;
  snapshot_id: string | null;
};

type PlaylistTrackItem = {
  added_at: string | null;
  added_by: { id: string } | null;
  track: SpotifyTrack | null;
};

type WatchlistRow = {
  artist_id: string;
  include_compilations: boolean;
};

type StoredTrackForPick = {
  id: string;
  name: string;
  artist_ids: string[];
  album_id: string | null;
  popularity: number;
  audio_features: AudioFeatures | null;
  saved_at: string;
  play_count_90: number;
  days_since_last_play: number | null;
};

export async function backfillSpotifyUser(tokens: SpotifyTokenSet): Promise<SpotifySyncResult> {
  const supabase = createServiceSupabaseClient();

  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Spotify backfill");
  }

  const profile = await spotifyFetch<SpotifyProfile>(tokens.accessToken, "https://api.spotify.com/v1/me");
  const userId = getDailySpinUserId(profile.id);
  const now = new Date().toISOString();

  await throwIfError(
    supabase.from("users").upsert({
      id: userId,
      spotify_id: profile.id,
      display_name: profile.display_name,
      email: profile.email,
      country: profile.country,
      onboarded_at: now
    })
  );

  if (tokens.refreshToken && tokens.expiresAt) {
    await throwIfError(
      supabase.from("spotify_accounts").upsert({
        user_id: userId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: new Date(tokens.expiresAt * 1000).toISOString(),
        scopes: []
      })
    );
  }

  const savedItems = await getAllSpotifyPages<SavedTrackItem>(tokens.accessToken, "https://api.spotify.com/v1/me/tracks?limit=50");
  const savedTracks = savedItems.map((item) => item.track).filter(isUsableTrack);
  await upsertTrackGraph(tokens.accessToken, savedTracks);

  await writeChunks(
    uniqueBy(
      savedItems.filter((item) => isUsableTrack(item.track)).map((item) => ({
        user_id: userId,
        track_id: item.track.id!,
        saved_at: item.added_at,
        last_seen_in_sync_at: now,
        removed_at: null
      })),
      (row) => `${row.user_id}:${row.track_id}`
    ),
    (chunk) => throwIfError(supabase.from("saved_tracks").upsert(chunk, { onConflict: "user_id,track_id" }))
  );

  const recentItems = await getAllSpotifyPages<RecentlyPlayedItem>(tokens.accessToken, "https://api.spotify.com/v1/me/player/recently-played?limit=50");
  const recentTracks = recentItems.map((item) => item.track).filter(isUsableTrack);
  await upsertTrackGraph(tokens.accessToken, recentTracks);
  await writeChunks(
    uniqueBy(
      recentItems.filter((item) => isUsableTrack(item.track)).map((item) => ({
        user_id: userId,
        track_id: item.track.id!,
        played_at: item.played_at,
        context_uri: item.context?.uri ?? null
      })),
      (row) => `${row.user_id}:${row.track_id}:${row.played_at}`
    ),
    (chunk) => throwIfError(supabase.from("listening_history").upsert(chunk, { onConflict: "user_id,track_id,played_at" }))
  );

  const playlists = await getAllSpotifyPages<PlaylistItem>(tokens.accessToken, "https://api.spotify.com/v1/me/playlists?limit=50");
  await writeChunks(
    uniqueBy(
      playlists.map((playlist) => normalizeSpotifyPlaylistForStorage(playlist, userId, profile.id, now)),
      (playlist) => playlist.id
    ),
    (chunk) => throwIfError(supabase.from("playlists").upsert(chunk, { onConflict: "id" }))
  );

  let playlistTrackCount = 0;
  let skippedPlaylists = 0;
  for (const playlist of playlists.filter((item) => item.owner?.id === profile.id)) {
    let playlistItems: PlaylistTrackItem[] = [];
    try {
      playlistItems = await getAllSpotifyPages<PlaylistTrackItem>(
        tokens.accessToken,
        `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=100&fields=items(added_at,added_by.id,track(id,name,artists(id,name),album(id,name,album_type,release_date,release_date_precision,images,artists(id,name),external_urls),duration_ms,explicit,popularity,external_urls,is_local)),next`
      );
    } catch (error) {
      if (error instanceof SpotifyApiError && (error.status === 403 || error.status === 404)) {
        skippedPlaylists += 1;
        continue;
      }

      throw error;
    }

    const tracks = playlistItems.map((item) => item.track).filter(isUsableTrack);
    await upsertTrackGraph(tokens.accessToken, tracks);
    await throwIfError(supabase.from("playlist_tracks").delete().eq("playlist_id", playlist.id));
    await writeChunks(
      uniqueBy(
        playlistItems
          .map((item, position) => ({ item, position }))
          .filter(({ item }) => isUsableTrack(item.track))
          .map(({ item, position }) => ({
            playlist_id: playlist.id,
            track_id: item.track!.id!,
            position,
            added_at: item.added_at ?? now,
            added_by: item.added_by?.id ?? profile.id
          })),
        (row) => `${row.playlist_id}:${row.track_id}:${row.position}`
      ),
      (chunk) => throwIfError(supabase.from("playlist_tracks").upsert(chunk, { onConflict: "playlist_id,track_id,position" }))
    );
    playlistTrackCount += tracks.length;
    await recomputePlaylistFingerprint(playlist.id, playlist.name, userId);
  }

  const audioFeatureResult = await fetchAndStoreAudioFeatures(tokens.accessToken, [...new Set([...savedTracks, ...recentTracks].map((track) => track.id!))]);
  const watchlistReleases = await syncWatchlistReleases(tokens.accessToken, userId);
  const morningPickComputed = await computeAndStoreMorningPick(userId);

  return {
    userId,
    spotifyId: profile.id,
    savedTracks: savedTracks.length,
    listeningHistory: recentTracks.length,
    playlists: playlists.length,
    playlistTracks: playlistTrackCount,
    skippedPlaylists,
    watchlistReleases,
    audioFeatures: audioFeatureResult,
    morningPickComputed
  };
}

async function syncWatchlistReleases(accessToken: string, userId: string): Promise<number> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Spotify backfill");
  }

  const { data: watchRows, error } = await supabase
    .from("watchlist_artists")
    .select("artist_id,include_compilations")
    .eq("user_id", userId);
  if (error) throw error;

  const watchlist = (watchRows ?? []) as WatchlistRow[];
  if (watchlist.length === 0) {
    return 0;
  }

  const since = new Date(Date.now() - 30 * 86_400_000);
  const albums: SpotifyAlbum[] = [];

  for (const artist of watchlist) {
    const includeGroups = artist.include_compilations ? "album,single,compilation" : "album,single";
    let artistAlbums: SpotifyAlbum[] = [];

    try {
      artistAlbums = await getAllSpotifyPages<SpotifyAlbum>(
        accessToken,
        `https://api.spotify.com/v1/artists/${artist.artist_id}/albums?include_groups=${includeGroups}&limit=50`
      );
    } catch (error) {
      if (error instanceof SpotifyApiError && (error.status === 400 || error.status === 403 || error.status === 404)) {
        continue;
      }

      throw error;
    }

    albums.push(...artistAlbums.filter((album) => isRecentAlbum(album, since)));
  }

  const uniqueAlbums = uniqueBy(albums, (album) => album.id);
  if (uniqueAlbums.length === 0) {
    return 0;
  }

  const artistMap = new Map<string, SpotifyArtist>();
  for (const album of uniqueAlbums) {
    album.artists.forEach((artist) => artistMap.set(artist.id, artist));
  }
  const artists = await fetchFullArtists(accessToken, [...artistMap.values()]);

  await writeChunks(
    uniqueBy(
      artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres ?? [],
        image_url: artist.images?.[0]?.url ?? null
      })),
      (artist) => artist.id
    ),
    (chunk) => throwIfError(supabase.from("artists").upsert(chunk, { onConflict: "id" }))
  );

  await writeChunks(
    uniqueAlbums.map((album) => ({
      id: album.id,
      name: album.name,
      artist_ids: album.artists.map((artist) => artist.id),
      album_type: normalizeAlbumType(album.album_type),
      release_date: normalizeReleaseDate(album.release_date, album.release_date_precision),
      release_date_precision: album.release_date_precision ?? "day",
      image_url: album.images?.[0]?.url ?? null,
      spotify_url: album.external_urls?.spotify ?? null
    })),
    (chunk) => throwIfError(supabase.from("albums").upsert(chunk, { onConflict: "id" }))
  );

  await writeChunks(
    uniqueAlbums.map((album) => ({
      user_id: userId,
      album_id: album.id,
      surfaced_at: new Date().toISOString()
    })),
    (chunk) => throwIfError(supabase.from("new_releases").upsert(chunk, { onConflict: "user_id,album_id" }))
  );

  return uniqueAlbums.length;
}

async function upsertTrackGraph(accessToken: string, tracks: SpotifyTrack[]): Promise<void> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Spotify backfill");
  }

  const artistMap = new Map<string, SpotifyArtist>();
  const albumMap = new Map<string, SpotifyAlbum>();

  for (const track of tracks) {
    track.artists.forEach((artist) => artistMap.set(artist.id, artist));
    track.album.artists.forEach((artist) => artistMap.set(artist.id, artist));
    albumMap.set(track.album.id, track.album);
  }
  const artists = await fetchFullArtists(accessToken, [...artistMap.values()]);

  await writeChunks(
    uniqueBy(
      artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres ?? [],
        image_url: artist.images?.[0]?.url ?? null
      })),
      (artist) => artist.id
    ),
    (chunk) => throwIfError(supabase.from("artists").upsert(chunk, { onConflict: "id" }))
  );

  await writeChunks(
    uniqueBy(
      [...albumMap.values()].map((album) => ({
        id: album.id,
        name: album.name,
        artist_ids: album.artists.map((artist) => artist.id),
        album_type: album.album_type ?? "album",
        release_date: normalizeReleaseDate(album.release_date, album.release_date_precision),
        release_date_precision: album.release_date_precision ?? "day",
        image_url: album.images?.[0]?.url ?? null,
        spotify_url: album.external_urls?.spotify ?? null
      })),
      (album) => album.id
    ),
    (chunk) => throwIfError(supabase.from("albums").upsert(chunk, { onConflict: "id" }))
  );

  await writeChunks(
    uniqueBy(tracks.map(normalizeSpotifyTrackForStorage), (track) => track.id),
    (chunk) => throwIfError(supabase.from("tracks").upsert(chunk, { onConflict: "id" }))
  );
}

async function fetchFullArtists(accessToken: string, artists: SpotifyArtist[]): Promise<SpotifyArtist[]> {
  const fallbackById = new Map(artists.map((artist) => [artist.id, artist]));
  const enrichedById = new Map<string, SpotifyArtist>();

  for (const ids of chunkArray([...fallbackById.keys()], 50)) {
    try {
      const payload = await spotifyFetch<{ artists: SpotifyArtist[] }>(accessToken, `https://api.spotify.com/v1/artists?ids=${ids.join(",")}`);
      payload.artists.forEach((artist) => enrichedById.set(artist.id, artist));
    } catch (error) {
      if (error instanceof SpotifyApiError && (error.status === 400 || error.status === 403 || error.status === 404)) {
        continue;
      }

      throw error;
    }
  }

  return [...fallbackById.entries()].map(([id, artist]) => enrichedById.get(id) ?? artist);
}

async function fetchAndStoreAudioFeatures(
  accessToken: string,
  trackIds: string[]
): Promise<SpotifySyncResult["audioFeatures"]> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Spotify backfill");
  }

  let stored = 0;

  for (const ids of chunkArray(trackIds, 100)) {
    const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${ids.join(",")}`, {
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      cache: "no-store"
    });

    if (response.status === 403 || response.status === 404) {
      return {
        requested: trackIds.length,
        stored,
        unavailable: true,
        status: response.status
      };
    }

    if (!response.ok) {
      throw new SpotifyApiError("Spotify audio-features request failed", response.status);
    }

    const payload = (await response.json()) as { audio_features: Array<SpotifyAudioFeatures | null> };
    const features = payload.audio_features.filter((item): item is SpotifyAudioFeatures => Boolean(item));
    stored += features.length;

    await Promise.all(
      features.map((feature) =>
        throwIfError(
          supabase
            .from("tracks")
            .update({
              audio_features: toAudioFeatures(feature),
              audio_features_fetched_at: new Date().toISOString()
            })
            .eq("id", feature.id)
        )
      )
    );
  }

  return {
    requested: trackIds.length,
    stored,
    unavailable: false,
    status: null
  };
}

async function computeAndStoreMorningPick(userId: string): Promise<boolean> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Spotify backfill");
  }

  const { data: savedRows, error: savedError } = await supabase
    .from("saved_tracks")
    .select("track_id,saved_at")
    .eq("user_id", userId)
    .is("removed_at", null);
  if (savedError) throw savedError;

  if (!savedRows || savedRows.length === 0) {
    return false;
  }

  const trackIds = savedRows.map((row) => row.track_id);
  const { data: tracks, error: trackError } = await supabase
    .from("tracks")
    .select("id,name,artist_ids,album_id,popularity,audio_features")
    .in("id", trackIds);
  if (trackError) throw trackError;

  const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: history, error: historyError } = await supabase
    .from("listening_history")
    .select("track_id,played_at")
    .eq("user_id", userId)
    .gte("played_at", since90);
  if (historyError) throw historyError;

  const savedAtByTrack = new Map(savedRows.map((row) => [row.track_id, row.saved_at]));
  const playsByTrack = new Map<string, string[]>();
  for (const play of history ?? []) {
    playsByTrack.set(play.track_id, [...(playsByTrack.get(play.track_id) ?? []), play.played_at]);
  }

  const candidates: PickCandidate[] = (tracks ?? [])
    .map((track): PickCandidate | null => {
      const savedAt = savedAtByTrack.get(track.id);
      if (!savedAt || !track.audio_features) {
        return null;
      }
      const playDates = playsByTrack.get(track.id) ?? [];
      const latest = playDates.map((date) => new Date(date).getTime()).sort((a, b) => b - a)[0] ?? null;
      return {
        id: track.id,
        name: track.name,
      artists: track.artist_ids.map((id) => ({ id, name: id })),
      albumName: track.album_id ?? "",
      imageUrl: null,
      spotifyUrl: `https://open.spotify.com/track/${track.id}`,
      savedAt,
      popularity: track.popularity,
      audioFeatures: track.audio_features,
      playCount90: playDates.length,
      daysSinceLastPlay: latest === null ? null : Math.floor((Date.now() - latest) / 86_400_000)
    };
    })
    .filter((track): track is PickCandidate => Boolean(track));

  if (candidates.length === 0) {
    const fallback = savedRows[Math.floor(Math.random() * savedRows.length)];
    await throwIfError(
      supabase.from("daily_picks").upsert(
        {
          user_id: userId,
          pick_date: toIsoDate(new Date()),
          track_id: fallback.track_id,
          reason: "Daily Spin is still learning your listening patterns, so this is a recommendation to try today. As more Spotify history syncs, these picks will get more personal.",
          score_breakdown: {
            recencyOfSave: 0,
            underplay: 0,
            affinity: 0,
            novelty: 0,
            composite: 0
          } satisfies Json
        },
        { onConflict: "user_id,pick_date,track_id" }
      )
    );
    return true;
  }

  const recentTrackIds = new Set((history ?? []).filter((play) => play.played_at >= since7).map((play) => play.track_id));
  const recentProfile = meanVector(candidates.filter((candidate) => recentTrackIds.has(candidate.id)).map(featureVector));
  const { data: recentPicks, error: picksError } = await supabase
    .from("daily_picks")
    .select("track_id,pick_date")
    .eq("user_id", userId)
    .gte("pick_date", toIsoDate(new Date(Date.now() - 14 * 86_400_000)));
  if (picksError) throw picksError;

  const chosen = chooseMorningPick(
    candidates,
    recentProfile,
    new Set((recentPicks ?? []).map((pick) => pick.track_id))
  );

  if (!chosen) {
    return false;
  }

  await throwIfError(
    supabase.from("daily_picks").upsert(
        {
          user_id: userId,
          pick_date: toIsoDate(new Date()),
          track_id: chosen.track.id,
          reason: formatMorningPickReason(chosen.track),
          score_breakdown: chosen.scoreBreakdown as unknown as Json
        },
      { onConflict: "user_id,pick_date,track_id" }
    )
  );

  return true;
}

function formatMorningPickReason(track: PickCandidate): string {
  if (track.playCount90 === 0) {
    return "You saved this and have not played it in the last 90 days. It is a good one to rescue from the quiet part of your library.";
  }

  if (track.daysSinceLastPlay !== null && track.daysSinceLastPlay >= 30) {
    return `You have played this before, but not for ${track.daysSinceLastPlay} days. It still fits your recent listening profile, so it is worth bringing back today.`;
  }

  if (track.popularity < 35) {
    return "This is one of the less obvious saved tracks in your library. Daily Spin picked it because it has enough signal without feeling overplayed.";
  }

  return "This saved track sits close to your recent listening, but it has not been crowding your rotation. It is a low-friction pick for today.";
}

async function recomputePlaylistFingerprint(playlistId: string, playlistName: string, userId: string): Promise<void> {
  const supabase = createServiceSupabaseClient();
  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Spotify backfill");
  }

  const { data: playlistTracks, error } = await supabase
    .from("playlist_tracks")
    .select("track_id,position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });
  if (error) throw error;

  const ids = (playlistTracks ?? []).map((row) => row.track_id);
  if (ids.length < 5) {
    return;
  }

  const { data: tracks, error: trackError } = await supabase.from("tracks").select("id,audio_features").in("id", ids);
  if (trackError) throw trackError;

  const featureById = new Map((tracks ?? []).map((track) => [track.id, track.audio_features]));
  const orderedFeatures = ids
    .map((id) => featureById.get(id))
    .filter((features): features is AudioFeatures => Boolean(features))
    .map(normalizeFeatures);

  if (orderedFeatures.length < 5) {
    return;
  }

  const core = meanFingerprint(orderedFeatures.slice(0, 30));
  const recent = meanFingerprint(orderedFeatures.slice(Math.max(0, orderedFeatures.length - 10)));
  const driftScore = getFingerprintDistance(core, recent);
  const healthLabel: HealthLabel = getHealthLabel({
    trackCount: ids.length,
    daysSinceLastEdit: 0,
    daysSinceLastPlay: null,
    driftScore
  });

  await throwIfError(
    supabase.from("playlist_fingerprints").upsert(
      {
        playlist_id: playlistId,
        core_centroid: core as unknown as Json,
        recent_centroid: recent as unknown as Json,
        drift_score: driftScore,
        health_label: healthLabel,
        computed_at: new Date().toISOString()
      },
      { onConflict: "playlist_id" }
    )
  );

  void playlistName;
  void userId;
}

function isUsableTrack(track: SpotifyTrack | null): track is SpotifyTrack & { id: string } {
  return Boolean(track?.id && !track.is_local);
}

function normalizeReleaseDate(releaseDate: string | null, precision: SpotifyAlbum["release_date_precision"]): string {
  if (!releaseDate) return "1900-01-01";
  if (precision === "year") return `${releaseDate}-01-01`;
  if (precision === "month") return `${releaseDate}-01`;
  return releaseDate;
}

function normalizeAlbumType(albumType: SpotifyAlbum["album_type"]): "album" | "single" | "compilation" {
  if (albumType === "single" || albumType === "compilation") {
    return albumType;
  }

  return "album";
}

function isRecentAlbum(album: SpotifyAlbum, since: Date): boolean {
  const releaseDate = normalizeReleaseDate(album.release_date, album.release_date_precision);
  return new Date(`${releaseDate}T00:00:00.000Z`) >= since;
}

export function normalizeSpotifyTrackForStorage(track: SpotifyTrack) {
  return {
    id: track.id!,
    name: track.name,
    artist_ids: track.artists.map((artist) => artist.id),
    album_id: track.album.id,
    duration_ms: track.duration_ms ?? 0,
    explicit: track.explicit ?? false,
    popularity: track.popularity ?? 0,
    spotify_url: track.external_urls?.spotify ?? null
  };
}

export function normalizeSpotifyPlaylistForStorage(
  playlist: PlaylistItem,
  userId: string,
  spotifyUserId: string,
  now: string
) {
  return {
    id: playlist.id,
    user_id: userId,
    name: playlist.name,
    description: playlist.description ?? "",
    owner_id: playlist.owner?.id ?? spotifyUserId,
    is_owned_by_user: playlist.owner?.id === spotifyUserId,
    track_count: playlist.tracks?.total ?? 0,
    snapshot_id: playlist.snapshot_id ?? "",
    last_modified_at: now
  };
}

function toAudioFeatures(feature: SpotifyAudioFeatures): AudioFeatures {
  return {
    energy: feature.energy,
    valence: feature.valence,
    tempo: feature.tempo,
    danceability: feature.danceability,
    acousticness: feature.acousticness,
    instrumentalness: feature.instrumentalness,
    liveness: feature.liveness,
    speechiness: feature.speechiness
  };
}

async function writeChunks<T>(items: T[], write: (chunk: T[]) => Promise<void>): Promise<void> {
  for (const chunk of chunkArray(items, 100)) {
    if (chunk.length > 0) {
      await write(chunk);
    }
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [getKey(item), item])).values()];
}

async function throwIfError<T>(promise: PromiseLike<{ error: T | null }>): Promise<void> {
  const { error } = await promise;
  if (error) {
    throw error;
  }
}
