import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getServerEnv } from "@/lib/env/server";

import type { GeneratedPlaylistMix, PlaylistMixSource, PlaylistMixTrack } from "./types";

const aiMixSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(220),
  libraryTrackIds: z
    .array(z.string().min(1))
    .min(1)
    .max(8),
  spotifySearches: z
    .array(
      z.object({
        query: z.string().min(1).max(120),
        reason: z.string().min(1).max(180)
      })
    )
    .min(1)
    .max(36)
});

export async function generatePlaylistMix({
  source,
  sourceTracks,
  likedTracks,
  goal,
  targetCount,
  accessToken
}: {
  source: PlaylistMixSource;
  sourceTracks: PlaylistMixTrack[];
  likedTracks: PlaylistMixTrack[];
  goal: string;
  targetCount: number;
  accessToken?: string;
}): Promise<GeneratedPlaylistMix> {
  const env = getServerEnv();
  const catalog = compactCatalog(sourceTracks, likedTracks);

  if (!env.ANTHROPIC_API_KEY) {
    return buildFallbackMix(source, catalog, goal, targetCount);
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1800,
    temperature: 0.7,
    system:
      "You design Spotify playlist mixes. Return strict JSON only. Do not wrap JSON in markdown. Use library IDs only from the provided catalog. For outside songs, provide Spotify search queries instead of made-up IDs.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          task:
            "Create a 20-ish song playlist. Include a few familiar anchor tracks from the catalog, then mostly outside songs that Spotify search can resolve. Balance source playlist identity with the user's liked-song taste.",
          source,
          goal,
          targetCount,
          requestedBlend: {
            familiarLibraryTracks: Math.max(3, Math.min(6, Math.round(targetCount * 0.25))),
            outsideSpotifyTracks: Math.max(8, targetCount - 5)
          },
          outputShape: {
            title: "short playlist title",
            description: "one sentence explaining the vibe",
            libraryTrackIds: ["catalog track id"],
            spotifySearches: [{ query: "track name artist name", reason: "why this outside song fits" }]
          },
          catalog
        })
      }
    ]
  });

  const text = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();

  try {
    const parsed = aiMixSchema.parse(JSON.parse(extractJson(text)));
    return await materializeMix(source, parsed, catalog, targetCount, accessToken);
  } catch (error) {
    console.error("Anthropic playlist mix parse failed", error);
    return buildFallbackMix(source, catalog, goal, targetCount);
  }
}

function compactCatalog(sourceTracks: PlaylistMixTrack[], likedTracks: PlaylistMixTrack[]): PlaylistMixTrack[] {
  const merged = [...sourceTracks, ...likedTracks];
  return [...new Map(merged.map((track) => [track.id, track])).values()].slice(0, 220);
}

async function materializeMix(
  source: PlaylistMixSource,
  parsed: z.infer<typeof aiMixSchema>,
  catalog: PlaylistMixTrack[],
  targetCount: number,
  accessToken?: string
): Promise<GeneratedPlaylistMix> {
  const trackById = new Map(catalog.map((track) => [track.id, track]));
  const familiarTracks = parsed.libraryTrackIds
    .map((id) => trackById.get(id))
    .filter((track): track is PlaylistMixTrack => Boolean(track))
    .slice(0, Math.max(3, Math.min(6, Math.round(targetCount * 0.25))))
    .map((track) => ({
      ...track,
      reason: "A familiar anchor from your own library."
    }));

  const externalTracks = accessToken
    ? await resolveSpotifySearches(accessToken, parsed.spotifySearches, new Set(catalog.map((track) => track.id)), targetCount - familiarTracks.length)
    : [];

  const tracks = interleaveTracks(familiarTracks, externalTracks)
    .filter((track): track is PlaylistMixTrack & { reason: string } => Boolean(track));

  return {
    title: parsed.title,
    description: parsed.description,
    source,
    tracks: tracks.slice(0, targetCount)
  };
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

async function resolveSpotifySearches(
  accessToken: string,
  searches: Array<{ query: string; reason: string }>,
  libraryTrackIds: Set<string>,
  limit: number
): Promise<Array<PlaylistMixTrack & { reason: string }>> {
  const tracks: Array<PlaylistMixTrack & { reason: string }> = [];
  const seenIds = new Set<string>(libraryTrackIds);

  for (const search of searches) {
    if (tracks.length >= limit) {
      break;
    }

    const candidates = await searchSpotifyTracks(accessToken, search.query);
    const candidate = candidates.find((track) => !seenIds.has(track.id));
    if (!candidate) {
      continue;
    }

    seenIds.add(candidate.id);
    tracks.push({
      ...candidate,
      reason: search.reason
    });
  }

  return tracks;
}

async function searchSpotifyTracks(accessToken: string, query: string): Promise<PlaylistMixTrack[]> {
  const response = await fetch(`https://api.spotify.com/v1/search?type=track&limit=3&q=${encodeURIComponent(query)}`, {
    headers: {
      authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    tracks?: {
      items?: Array<{
        id: string;
        name: string;
        uri: string;
        popularity?: number;
        external_urls?: { spotify?: string };
        artists: Array<{ name: string }>;
        album: {
          name: string;
          images?: Array<{ url: string }>;
        };
      }>;
    };
  };

  return (payload.tracks?.items ?? [])
    .filter((track) => Boolean(track.id && track.uri))
    .map((track) => ({
      id: track.id,
      uri: track.uri,
      name: track.name,
      artists: track.artists.map((artist) => artist.name),
      albumName: track.album.name,
      imageUrl: track.album.images?.[0]?.url ?? null,
      spotifyUrl: track.external_urls?.spotify ?? null,
      popularity: track.popularity ?? 0,
      source: "spotify",
      audioFeatures: null
    }));
}

function interleaveTracks(
  familiarTracks: Array<PlaylistMixTrack & { reason: string }>,
  externalTracks: Array<PlaylistMixTrack & { reason: string }>
): Array<PlaylistMixTrack & { reason: string }> {
  const tracks: Array<PlaylistMixTrack & { reason: string }> = [];
  const familiar = [...familiarTracks];
  const external = [...externalTracks];

  while (familiar.length > 0 || external.length > 0) {
    tracks.push(...external.splice(0, 4));
    const anchor = familiar.shift();
    if (anchor) {
      tracks.push(anchor);
    }
  }

  return tracks;
}

function buildFallbackMix(source: PlaylistMixSource, catalog: PlaylistMixTrack[], goal: string, targetCount: number): GeneratedPlaylistMix {
  const ranked = [...catalog].sort((a, b) => b.popularity - a.popularity).slice(0, targetCount);

  return {
    title: `${source.name} refresh`,
    description: goal || `A refreshed path through ${source.name}, grounded in tracks already in your library.`,
    source,
    tracks: ranked.map((track) => ({
      ...track,
      reason: "This already has strong signal in your library and fits the source mix."
    }))
  };
}
