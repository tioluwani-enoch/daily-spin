"use client";

import { Heart, ListMusic, Play, Save, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { reconnectSpotify } from "@/lib/auth/ui/SpotifyConnectButton";
import { Button, Input } from "@/lib/ui";

import type { GeneratedPlaylistMix, PlaylistMixSource } from "../types";

export function PlaylistMixer({ sources }: { sources: PlaylistMixSource[] }) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [goal, setGoal] = useState("Make this feel fresh without losing my taste.");
  const [mix, setMix] = useState<GeneratedPlaylistMix | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveAsPlaylist, setSaveAsPlaylist] = useState(true);
  const [addToLiked, setAddToLiked] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveDescription, setSaveDescription] = useState("");
  const [coverImageBase64, setCoverImageBase64] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsSpotifyReconnect, setNeedsSpotifyReconnect] = useState(false);
  const [likedTrackIds, setLikedTrackIds] = useState<Set<string>>(new Set());
  const [likingTrackIds, setLikingTrackIds] = useState<Set<string>>(new Set());

  const sourceOptions = useMemo(() => sources.filter((source) => source.trackCount > 0), [sources]);

  async function generateMix() {
    setIsGenerating(true);
    setNotice(null);
    setNeedsSpotifyReconnect(false);
    try {
      const response = await fetch("/api/playlist-mixer/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId, goal, targetCount: 18 })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not generate a playlist");
      }
      setMix(payload.mix);
      setSaveTitle(payload.mix.title);
      setSaveDescription(payload.mix.description);
      setCoverImageBase64(null);
      setLikedTrackIds(new Set(payload.mix.tracks.filter((track: GeneratedPlaylistMix["tracks"][number]) => track.source === "library").map((track: GeneratedPlaylistMix["tracks"][number]) => track.id)));
      setLikingTrackIds(new Set());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not generate a playlist");
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveMix() {
    if (!mix) return;
    setIsSaving(true);
    setNotice(null);
    setNeedsSpotifyReconnect(false);
    try {
      const response = await fetch("/api/playlist-mixer/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: saveDescription,
          title: saveTitle || mix.title,
          trackIds: mix.tracks.map((track) => track.id),
          saveAsPlaylist,
          addToLiked,
          coverImageBase64: coverImageBase64 ?? undefined
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setNeedsSpotifyReconnect(isReconnectPayload(payload));
        throw new Error(payload.error ?? "Could not save this mix");
      }
      setNotice(payload.playlist?.external_urls?.spotify ? "Saved to Spotify." : "Saved to Liked Songs.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save this mix");
    } finally {
      setIsSaving(false);
    }
  }

  function playMix(startIndex = 0) {
    if (!mix || mix.tracks.length === 0) {
      return;
    }

    const track = mix.tracks[startIndex] ?? mix.tracks[0];
    window.dispatchEvent(
      new CustomEvent("daily-spin:play-track", {
        detail: {
          uri: track.uri,
          queueUris: mix.tracks.map((item) => item.uri),
          queueTracks: mix.tracks.map((item) => ({
            uri: item.uri,
            name: item.name,
            artists: item.artists,
            album: item.albumName,
            imageUrl: item.imageUrl,
            audioFeatures: item.audioFeatures
              ? {
                  energy: item.audioFeatures.energy,
                  valence: item.audioFeatures.valence,
                  tempo: item.audioFeatures.tempo
                }
              : null
          })),
          queueIndex: startIndex,
          name: track.name,
          artists: track.artists,
          album: track.albumName,
          imageUrl: track.imageUrl,
          audioFeatures: track.audioFeatures
            ? {
                energy: track.audioFeatures.energy,
                valence: track.audioFeatures.valence,
                tempo: track.audioFeatures.tempo
              }
            : null
        }
      })
    );
  }

  async function likeTrack(trackId: string) {
    if (likedTrackIds.has(trackId) || likingTrackIds.has(trackId)) {
      return;
    }

    setNotice(null);
    setNeedsSpotifyReconnect(false);
    setLikingTrackIds((ids) => new Set(ids).add(trackId));

    try {
      const response = await fetch("/api/spotify/liked-track", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trackId })
      });
      const payload = await response.json();
      if (!response.ok) {
        setNeedsSpotifyReconnect(isReconnectPayload(payload));
        throw new Error(payload.error ?? "Could not add this track to Liked Songs");
      }
      setLikedTrackIds((ids) => new Set(ids).add(trackId));
      setNotice("Added to Liked Songs.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not add this track to Liked Songs");
    } finally {
      setLikingTrackIds((ids) => removeSetValue(ids, trackId));
    }
  }

  async function chooseCover(file: File | null) {
    setNotice(null);
    if (!file) {
      setCoverImageBase64(null);
      return;
    }

    try {
      setCoverImageBase64(await fileToSpotifyCoverBase64(file));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not read that image");
    }
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-lg border border-ambient-edge bg-ambient-surface p-4 shadow-ambient backdrop-blur sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] lg:items-end">
          <label className="grid flex-1 gap-2">
            <span className="font-mono text-mono-sm uppercase text-ambient-muted">Source</span>
            <select
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              className="min-h-11 w-full rounded-md border border-ambient-edge bg-white/35 px-3 text-body text-ambient-fg outline-none transition focus:border-ambient-accent"
            >
              {sourceOptions.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name} ({source.trackCount})
                </option>
              ))}
            </select>
          </label>
          <label className="grid flex-[2] gap-2">
            <span className="font-mono text-mono-sm uppercase text-ambient-muted">Direction</span>
            <Input value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={240} />
          </label>
          <Button onClick={generateMix} disabled={!sourceId || isGenerating} variant="accent" className="w-full lg:min-w-40">
            <Sparkles size={16} aria-hidden />
            {isGenerating ? "Creating" : "Create mix"}
          </Button>
        </div>
        {notice ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-meta text-ambient-muted">{notice}</p>
            {needsSpotifyReconnect ? (
              <Button type="button" variant="accent" onClick={() => void reconnectSpotify()} className="w-full sm:w-auto">
                Reconnect Spotify
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {mix ? (
        <div className="grid gap-5">
          <div className="rounded-lg border border-ambient-edge bg-ambient-surface p-4 shadow-ambient backdrop-blur sm:p-6">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] md:items-start">
              <div className="min-w-0">
                <p className="font-mono text-mono-sm uppercase text-ambient-muted">Generated from {mix.source.name}</p>
                <h2 className="mt-1 break-words text-h2 text-ambient-fg">{mix.title}</h2>
                <p className="mt-2 max-w-2xl text-meta text-ambient-muted">{mix.description}</p>
                <div className="mt-4 flex flex-wrap gap-2 font-mono text-mono-sm uppercase text-ambient-muted">
                  <span>{mix.tracks.length} tracks</span>
                  <span>{mix.tracks.filter((track) => track.source === "spotify").length} new finds</span>
                  <span>{mix.tracks.filter((track) => track.source === "library").length} library anchors</span>
                </div>
                <div className="mt-5">
                  <Button type="button" onClick={() => playMix()} variant="accent" className="w-full sm:w-auto">
                    <Play size={16} aria-hidden />
                    Listen
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 rounded-md border border-ambient-edge bg-white/25 p-3">
                <label className="grid gap-1">
                  <span className="font-mono text-mono-sm uppercase text-ambient-muted">Playlist name</span>
                  <Input value={saveTitle} onChange={(event) => setSaveTitle(event.target.value)} maxLength={100} />
                </label>
                <label className="grid gap-1">
                  <span className="font-mono text-mono-sm uppercase text-ambient-muted">Description</span>
                  <textarea
                    value={saveDescription}
                    onChange={(event) => setSaveDescription(event.target.value)}
                    maxLength={300}
                    className="min-h-24 w-full resize-none rounded-md border border-ambient-edge bg-white/35 px-3 py-2 text-body text-ambient-fg outline-none transition placeholder:text-ambient-muted focus:border-ambient-accent"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="font-mono text-mono-sm uppercase text-ambient-muted">Cover image</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => void chooseCover(event.target.files?.[0] ?? null)}
                    className="w-full max-w-full text-meta text-ambient-muted file:mr-3 file:rounded-md file:border file:border-ambient-edge file:bg-white/35 file:px-3 file:py-2 file:text-meta file:text-ambient-fg"
                  />
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-3 text-meta text-ambient-muted">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={saveAsPlaylist} onChange={(event) => setSaveAsPlaylist(event.target.checked)} />
                      New playlist
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={addToLiked} onChange={(event) => setAddToLiked(event.target.checked)} />
                      Add to Liked
                    </label>
                  </div>
                  <Button onClick={saveMix} disabled={isSaving || (!saveAsPlaylist && !addToLiked) || !saveTitle.trim()} variant="ghost" className="w-full sm:w-auto sm:min-w-28">
                    <Save size={16} aria-hidden />
                    {isSaving ? "Saving" : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            {mix.tracks.map((track, index) => (
              <article key={track.id} className="rounded-md border border-ambient-edge bg-white/30 p-3">
                <div className="grid gap-3 sm:grid-cols-[3rem_minmax(0,1fr)] md:grid-cols-[3rem_minmax(0,1fr)_auto] md:items-center">
                  {track.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.imageUrl} alt="" className="h-12 w-12 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-md border border-ambient-edge text-ambient-muted">
                      <ListMusic size={18} aria-hidden />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="break-words text-meta font-semibold text-ambient-fg">
                      {index + 1}. {track.name}
                    </p>
                    <p className="break-words text-meta text-ambient-muted">{track.artists.join(", ")}</p>
                    <p className="mt-1 text-meta text-ambient-muted">
                      <span className="font-mono uppercase">{track.source === "spotify" ? "New find" : "From library"}</span> &middot; {track.reason}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:col-start-2 md:col-start-auto md:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void likeTrack(track.id)}
                      disabled={likedTrackIds.has(track.id) || likingTrackIds.has(track.id)}
                      className={`min-h-9 px-2 ${likedTrackIds.has(track.id) ? "border-ambient-accent bg-ambient-accent/10 text-ambient-accent" : ""}`}
                      aria-label={`${likedTrackIds.has(track.id) ? "Added" : "Add"} ${track.name} to Liked Songs`}
                      title={likedTrackIds.has(track.id) ? "Added to Liked Songs" : "Add to Liked Songs"}
                    >
                      <Heart size={15} aria-hidden fill={likedTrackIds.has(track.id) ? "currentColor" : "none"} />
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => playMix(index)} className="min-h-9 px-2">
                      <Play size={15} aria-hidden />
                    </Button>
                    {track.spotifyUrl ? (
                      <a href={track.spotifyUrl} className="text-meta text-ambient-accent hover:text-ambient-accent-soft" target="_blank" rel="noreferrer">
                        Open
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function removeSetValue<T>(values: Set<T>, value: T): Set<T> {
  const nextValues = new Set(values);
  nextValues.delete(value);
  return nextValues;
}

function isReconnectPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  return "requiredScope" in payload || "requiredScopes" in payload;
}

async function fileToSpotifyCoverBase64(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  const size = 640;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare that cover image");
  }

  const scale = Math.max(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);

  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    const jpeg = canvas.toDataURL("image/jpeg", quality);
    const base64 = jpeg.replace(/^data:image\/jpeg;base64,/, "");
    if (base64.length <= 256_000) {
      return base64;
    }
  }

  throw new Error("That image is too large for Spotify after compression. Try a smaller square image.");
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load that image"));
    image.src = src;
  });
}
