"use client";

import { Maximize2, Minimize2, Pause, Play, SkipBack, SkipForward, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/lib/ui";

type PlayerStatus = "idle" | "loading" | "ready" | "error";

type PlayTrackPayload = {
  uri: string;
  queueUris?: string[];
  queueIndex?: number;
  name?: string;
  artists?: string[];
  album?: string;
  imageUrl?: string | null;
};

type PlayTrackEvent = CustomEvent<PlayTrackPayload>;

type QueueTrack = {
  uri: string;
  name: string;
  artists: string[];
  album: string;
  imageUrl: string | null;
};

export function SpotifyWebPlayer() {
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const queueUrisRef = useRef<string[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [message, setMessage] = useState("Connect Spotify, then start the in-app player.");
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrackWindow | null>(null);
  const [pendingTrack, setPendingTrack] = useState<PlayTrackEvent["detail"] | null>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [queueUris, setQueueUris] = useState<string[]>([]);
  const [queueTracks, setQueueTracks] = useState<QueueTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    queueUrisRef.current = queueUris;
  }, [queueUris]);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const interval = window.setInterval(async () => {
      const state = await playerRef.current?.getCurrentState();
      if (!state) {
        return;
      }

      const nextTrack = state.track_window.current_track ?? null;
      setCurrentTrack(nextTrack);
      setIsPaused(state.paused);
      setPosition(state.position);
      setDuration(state.duration);

      if (nextTrack && queueUrisRef.current.length > 0) {
        const nextIndex = queueUrisRef.current.findIndex((uri) => uri === nextTrack.uri);
        if (nextIndex >= 0) {
          setQueueIndex(nextIndex);
        }
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    async function getOAuthToken(callback: (token: string) => void) {
      const response = await fetch("/api/spotify/player-token");
      const payload = (await response.json()) as { accessToken?: string; error?: string };

      if (!response.ok || !payload.accessToken) {
        setStatus("error");
        setMessage(payload.error ?? "Spotify token is not available.");
        return;
      }

      callback(payload.accessToken);
    }

    function initializePlayer() {
      if (!window.Spotify || playerRef.current) {
        return;
      }

      setStatus("loading");
      const player = new window.Spotify.Player({
        name: "Daily Spin",
        getOAuthToken,
        volume: 0.75
      });

      player.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        setStatus("ready");
        setMessage("Daily Spin is ready as a Spotify playback device.");
      });

      player.addListener("not_ready", () => {
        setDeviceId(null);
        setMessage("Daily Spin player disconnected.");
      });

      player.addListener("player_state_changed", (state) => {
        const nextTrack = state?.track_window.current_track ?? null;
        setCurrentTrack(nextTrack);
        setIsPaused(state?.paused ?? true);
        setPosition(state?.position ?? 0);
        setDuration(state?.duration ?? 0);

        if (nextTrack && queueUrisRef.current.length > 0) {
          const nextIndex = queueUrisRef.current.findIndex((uri) => uri === nextTrack.uri);
          if (nextIndex >= 0) {
            setQueueIndex(nextIndex);
          }
        }
      });

      player.addListener("account_error", ({ message: errorMessage }) => {
        setStatus("error");
        setMessage(`${errorMessage} Spotify Premium is required for in-app playback.`);
      });

      player.addListener("authentication_error", ({ message: errorMessage }) => {
        setStatus("error");
        setMessage(
          errorMessage.includes("scope")
            ? "Spotify gave Daily Spin an old token without Web Playback access. Disconnect, remove Daily Spin from your Spotify Apps page, then connect again."
            : errorMessage
        );
      });

      player.addListener("playback_error", ({ message: errorMessage }) => {
        setStatus("error");
        setMessage(errorMessage);
      });

      player.connect();
      playerRef.current = player;
    }

    window.onSpotifyWebPlaybackSDKReady = initializePlayer;

    if (!document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    } else {
      initializePlayer();
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    async function playTrack(event: Event) {
      const trackEvent = event as PlayTrackEvent;
      const resolvedQueue = await resolvePlaybackQueue(trackEvent.detail);

      setPendingTrack(resolvedQueue.pendingTrack);
      setQueueUris(resolvedQueue.uris);
      setQueueTracks(resolvedQueue.tracks);
      setQueueIndex(resolvedQueue.index);
      setIsExpanded(true);

      if (!deviceId) {
        setStatus("error");
        setMessage("The Daily Spin player is still starting. Wait for it to say ready, then press play again.");
        return;
      }

      const response = await fetch("/api/spotify/play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId,
          uri: trackEvent.detail.uri,
          uris: resolvedQueue.uris,
          offset: resolvedQueue.index
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string; status?: number };
        setStatus("error");
        setDeviceId(null);
        setMessage(
          `${payload.error ?? "Playback failed"}${payload.status ? ` (${payload.status})` : ""}. Spotify lost the browser device; refresh the page and wait for the player to reconnect.`
        );
        return;
      }

      setStatus("ready");
    }

    window.addEventListener("daily-spin:play-track", playTrack);
    return () => window.removeEventListener("daily-spin:play-track", playTrack);
  }, [deviceId]);

  const playQueueIndex = useCallback(
    async (nextIndex: number) => {
      if (!deviceId || queueUris.length === 0) {
        return;
      }

      const normalizedIndex = (nextIndex + queueUris.length) % queueUris.length;
      setQueueIndex(normalizedIndex);
      if (queueTracks[normalizedIndex]) {
        setPendingTrack(queueTrackToPayload(queueTracks[normalizedIndex]));
      }
      const response = await fetch("/api/spotify/play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deviceId,
          uris: queueUris,
          offset: normalizedIndex
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string; status?: number };
        setStatus("error");
        setMessage(`${payload.error ?? "Playback failed"}${payload.status ? ` (${payload.status})` : ""}. Try playing the track again so Daily Spin can rebuild the queue.`);
        return;
      }

      setStatus("ready");
    },
    [deviceId, queueTracks, queueUris]
  );

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const interval = window.setInterval(async () => {
      const state = await playerRef.current?.getCurrentState();
      if (!state || state.paused || queueUrisRef.current.length < 2) {
        return;
      }

      const isAtEnd = state.duration > 0 && state.duration - state.position <= 900;
      if (isAtEnd) {
        const currentIndex = queueUrisRef.current.findIndex((uri) => uri === state.track_window.current_track.uri);
        await playQueueIndex(currentIndex >= 0 ? currentIndex + 1 : queueIndex + 1);
      }
    }, 1200);

    return () => window.clearInterval(interval);
  }, [playQueueIndex, queueIndex, status]);

  const miniArtUrl = currentTrack?.album.images[0]?.url ?? pendingTrack?.imageUrl ?? "";

  return (
    <>
      <aside className="fixed inset-x-3 bottom-3 z-40 overflow-hidden rounded-lg border border-ambient-edge bg-ambient-surface shadow-ambient backdrop-blur-xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[22rem]">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.08] blur-xl"
          style={{ backgroundImage: miniArtUrl ? `url(${miniArtUrl})` : undefined }}
        />
        <div className="absolute inset-0 bg-ambient-surface/85" />
        <div className="relative p-3">
          <div className="flex items-center gap-3">
            {currentTrack?.album.images[0]?.url || pendingTrack?.imageUrl ? (
              <img className="h-14 w-14 shrink-0 rounded-md border border-ambient-edge object-cover" src={currentTrack?.album.images[0]?.url ?? pendingTrack?.imageUrl ?? ""} alt="" />
            ) : (
              <div className="h-14 w-14 shrink-0 rounded-md border border-ambient-edge bg-ambient-alt" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-mono text-mono-sm uppercase text-ambient-muted">Player</p>
              <h2 className="truncate text-h2 text-ambient-fg">{currentTrack?.name ?? pendingTrack?.name ?? "Daily Spin"}</h2>
              <p className="truncate font-mono text-mono-sm text-ambient-muted">
                {currentTrack ? currentTrack.artists.map((artist) => artist.name).join(", ") : pendingTrack?.artists?.join(", ") ?? message}
              </p>
            </div>
          </div>
          <ProgressBar position={position} duration={duration} />
          <PlayerControls
            isPaused={isPaused}
            isReady={status === "ready"}
            onPrevious={() => (queueUris.length > 1 ? playQueueIndex(queueIndex - 1) : playerRef.current?.previousTrack())}
            onToggle={() => playerRef.current?.togglePlay()}
            onNext={() => (queueUris.length > 1 ? playQueueIndex(queueIndex + 1) : playerRef.current?.nextTrack())}
            onExpand={() => setIsExpanded(true)}
            canExpand={Boolean(currentTrack)}
          />
          <div className="mt-2 flex items-center gap-2 font-mono text-mono-sm text-ambient-muted">
            <Volume2 className="h-4 w-4" strokeWidth={1.5} />
            {deviceId ? (queueUris.length > 1 ? `${queueIndex + 1} of ${queueUris.length}` : "Ready") : "Connecting"}
          </div>
        </div>
      </aside>

      {isExpanded && (currentTrack || pendingTrack) ? (
        <NowPlayingModal
          track={currentTrack}
          pendingTrack={pendingTrack}
          isPaused={isPaused}
          queueUris={queueUris}
          queueTracks={queueTracks}
          queueIndex={queueIndex}
          position={position}
          duration={duration}
          onClose={() => setIsExpanded(false)}
          onPrevious={() => (queueUris.length > 1 ? playQueueIndex(queueIndex - 1) : playerRef.current?.previousTrack())}
          onToggle={() => playerRef.current?.togglePlay()}
          onNext={() => (queueUris.length > 1 ? playQueueIndex(queueIndex + 1) : playerRef.current?.nextTrack())}
          onSelectQueueTrack={playQueueIndex}
        />
      ) : null}
    </>
  );
}

async function resolvePlaybackQueue(payload: PlayTrackPayload): Promise<{
  uris: string[];
  index: number;
  tracks: QueueTrack[];
  pendingTrack: PlayTrackPayload;
}> {
  if (payload.queueUris && payload.queueUris.length > 1) {
    const shuffledUris = shuffleQueueAroundCurrent(payload.queueUris, payload.uri);
    return {
      uris: shuffledUris,
      index: Math.max(0, shuffledUris.findIndex((uri) => uri === payload.uri)),
      tracks: shuffledUris.map((uri, index) =>
        uri === payload.uri
          ? payloadToQueueTrack(payload)
          : {
              uri,
              name: `Track ${index + 1}`,
              artists: [],
              album: "Daily Spin",
              imageUrl: null
            }
      ),
      pendingTrack: payload
    };
  }

  try {
    const response = await fetch("/api/spotify/library-preview");
    const data = (await response.json()) as { tracks?: QueueTrack[] };
    const tracks = data.tracks ?? [];
    const previewUris = tracks.map((track) => track.uri).filter(Boolean);
    const queueUris = shuffleQueueAroundCurrent(uniqueStrings(previewUris.includes(payload.uri) ? previewUris : [payload.uri, ...previewUris]), payload.uri);
    const selectedTrack = tracks.find((track) => track.uri === payload.uri);

    return {
      uris: queueUris.length > 0 ? queueUris : [payload.uri],
      index: Math.max(0, queueUris.findIndex((uri) => uri === payload.uri)),
      tracks: queueUris.map((uri) => tracks.find((track) => track.uri === uri) ?? payloadToQueueTrack({ ...payload, uri })),
      pendingTrack: {
        ...payload,
        name: payload.name ?? selectedTrack?.name,
        artists: payload.artists ?? selectedTrack?.artists,
        album: payload.album ?? selectedTrack?.album,
        imageUrl: payload.imageUrl ?? selectedTrack?.imageUrl
      }
    };
  } catch {
    return {
      uris: [payload.uri],
      index: 0,
      tracks: [payloadToQueueTrack(payload)],
      pendingTrack: payload
    };
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function shuffleQueueAroundCurrent(values: string[], currentUri: string): string[] {
  const current = values.includes(currentUri) ? currentUri : values[0];
  const rest = values.filter((uri) => uri !== current);

  for (let index = rest.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [rest[index], rest[swapIndex]] = [rest[swapIndex], rest[index]];
  }

  return current ? [current, ...rest] : rest;
}

function payloadToQueueTrack(payload: PlayTrackPayload): QueueTrack {
  return {
    uri: payload.uri,
    name: payload.name ?? "Daily Spin track",
    artists: payload.artists ?? [],
    album: payload.album ?? "Daily Spin",
    imageUrl: payload.imageUrl ?? null
  };
}

function queueTrackToPayload(track: QueueTrack): PlayTrackPayload {
  return {
    uri: track.uri,
    name: track.name,
    artists: track.artists,
    album: track.album,
    imageUrl: track.imageUrl
  };
}

function PlayerControls({
  isPaused,
  isReady,
  onPrevious,
  onToggle,
  onNext,
  onExpand,
  canExpand
}: {
  isPaused: boolean;
  isReady: boolean;
  onPrevious: () => void;
  onToggle: () => void;
  onNext: () => void;
  onExpand: () => void;
  canExpand: boolean;
}) {
  return (
    <div className="mt-3 grid grid-cols-[auto_1fr_auto_auto] items-center gap-2">
      <Button type="button" variant="ghost" onClick={onPrevious} disabled={!isReady}>
        <SkipBack className="h-4 w-4" strokeWidth={1.5} />
      </Button>
      <Button type="button" variant="accent" onClick={onToggle} disabled={!isReady}>
        {isPaused ? <Play className="h-4 w-4" strokeWidth={1.5} /> : <Pause className="h-4 w-4" strokeWidth={1.5} />}
        {isPaused ? "Play" : "Pause"}
      </Button>
      <Button type="button" variant="ghost" onClick={onNext} disabled={!isReady}>
        <SkipForward className="h-4 w-4" strokeWidth={1.5} />
      </Button>
      <Button type="button" variant="quiet" onClick={onExpand} disabled={!canExpand}>
        <Maximize2 className="h-4 w-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
}

function ProgressBar({ position, duration }: { position: number; duration: number }) {
  const percent = duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;

  return (
    <div className="mt-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-ambient-edge">
        <div className="h-full rounded-full bg-ambient-accent" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.68rem] text-ambient-muted">
        <span>{formatMs(position)}</span>
        <span>{formatMs(duration)}</span>
      </div>
    </div>
  );
}

function formatMs(value: number): string {
  if (!value) return "0:00";
  const totalSeconds = Math.floor(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function NowPlayingModal({
  track,
  pendingTrack,
  isPaused,
  queueUris,
  queueTracks,
  queueIndex,
  position,
  duration,
  onClose,
  onPrevious,
  onToggle,
  onNext,
  onSelectQueueTrack
}: {
  track: SpotifyTrackWindow | null;
  pendingTrack: PlayTrackEvent["detail"] | null;
  isPaused: boolean;
  queueUris: string[];
  queueTracks: QueueTrack[];
  queueIndex: number;
  position: number;
  duration: number;
  onClose: () => void;
  onPrevious: () => void;
  onToggle: () => void;
  onNext: () => void;
  onSelectQueueTrack: (index: number) => void;
}) {
  const imageUrl = track?.album.images[0]?.url ?? pendingTrack?.imageUrl ?? "";
  const trackName = track?.name ?? pendingTrack?.name ?? "Preparing track";
  const artists = track ? track.artists.map((artist) => artist.name).join(", ") : pendingTrack?.artists?.join(", ") ?? "Spotify is connecting";
  const album = track?.album.name ?? pendingTrack?.album ?? "Daily Spin";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/35 backdrop-blur-xl">
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-3xl"
        style={{
          backgroundImage: imageUrl ? `url(${imageUrl})` : undefined
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.24),rgba(31,27,23,0.74))]" />

      <div className="absolute inset-x-0 top-[38%] -translate-y-1/2 pointer-events-none">
        <WaveBars isPaused={isPaused} />
      </div>

      <section className="absolute inset-x-3 top-1/2 flex max-h-[92dvh] -translate-y-1/2 flex-col overflow-y-auto rounded-lg border border-white/25 bg-white/18 p-4 text-white shadow-ambient backdrop-blur-2xl sm:left-1/2 sm:right-auto sm:w-[min(62rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:overflow-hidden sm:p-8">
        <div
          className="absolute inset-x-0 top-0 h-24 opacity-60 blur-2xl"
          style={{
            backgroundImage: imageUrl ? `linear-gradient(90deg, transparent, rgba(255,255,255,0.36), transparent), url(${imageUrl})` : undefined,
            backgroundSize: "cover"
          }}
        />
        <div className="relative flex justify-end">
          <button className="rounded-md border border-white/30 p-2 text-white/85 transition hover:text-white" type="button" onClick={onClose} aria-label="Close player">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="relative grid min-h-0 gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(18rem,0.92fr)]">
          <div className="min-w-0">
            {imageUrl ? <img className="aspect-square w-full rounded-md border border-white/25 object-cover shadow-ambient sm:max-h-[42vh] lg:max-h-[48vh]" src={imageUrl} alt="" /> : null}
            <div className="mt-5 sm:mt-7">
              <p className="font-mono text-mono-sm uppercase text-white/70">Now playing</p>
              <h2 className="mt-3 break-words text-h1 text-white sm:text-display">{trackName}</h2>
              <p className="mt-2 break-words font-mono text-mono-sm text-white/72 sm:truncate">{artists}</p>
              <p className="mt-1 break-words text-meta text-white/62 sm:truncate">{album}</p>
              <div className="mt-5">
                <ProgressBar position={position} duration={duration} />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-[auto_1fr_auto_auto] items-center gap-3">
              <button className="rounded-md border border-white/25 bg-white/10 p-3 transition hover:bg-white/18" type="button" onClick={onPrevious} aria-label="Previous track">
                <SkipBack className="h-5 w-5" strokeWidth={1.5} />
              </button>
              <button className="inline-flex min-h-12 items-center gap-2 rounded-md bg-white px-5 text-meta text-black transition hover:bg-white/85" type="button" onClick={onToggle}>
                {isPaused ? <Play className="h-5 w-5" strokeWidth={1.5} /> : <Pause className="h-5 w-5" strokeWidth={1.5} />}
                {isPaused ? "Play" : "Pause"}
              </button>
              <button className="rounded-md border border-white/25 bg-white/10 p-3 transition hover:bg-white/18" type="button" onClick={onNext} aria-label="Next track">
                <SkipForward className="h-5 w-5" strokeWidth={1.5} />
              </button>
              <button className="rounded-md border border-white/25 bg-white/10 p-3 transition hover:bg-white/18" type="button" onClick={onClose} aria-label="Minimize player">
                <Minimize2 className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {queueUris.length > 1 ? (
            <aside className="min-h-0 rounded-md bg-black/10 p-3 lg:mt-12 lg:max-h-[64vh]">
              <div className="flex items-end justify-between gap-3 px-1 pb-4">
                <div>
                  <p className="font-mono text-mono-sm uppercase text-white/62">Up next</p>
                  <p className="mt-1 font-mono text-mono-sm text-white/42">{queueIndex + 1} of {queueUris.length}</p>
                </div>
              </div>
              <div className="player-queue-scroll max-h-56 overflow-y-auto pr-1 lg:max-h-[calc(64vh-4.5rem)]">
                {queueUris.map((uri, index) => {
                  const item = queueTracks[index];
                  const isCurrent = index === queueIndex;

                  return (
                    <button
                      key={`${uri}-${index}`}
                      className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition ${
                        isCurrent ? "bg-white text-black" : "text-white/78 hover:bg-white/12 hover:text-white"
                      }`}
                      type="button"
                      onClick={() => onSelectQueueTrack(index)}
                    >
                      {item?.imageUrl ? <img className="h-9 w-9 rounded object-cover" src={item.imageUrl} alt="" /> : <span className="h-9 w-9 rounded bg-white/12" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-meta">{item?.name ?? `Track ${index + 1}`}</span>
                        <span className={`block truncate font-mono text-mono-sm ${isCurrent ? "text-black/58" : "text-white/55"}`}>
                          {item?.artists.join(", ") || uri.replace("spotify:track:", "")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function WaveBars({ isPaused }: { isPaused: boolean }) {
  return (
    <span className={`wave-bars ${isPaused ? "wave-bars-paused" : ""}`} aria-hidden="true">
      {Array.from({ length: 100 }).map((_, index) => (
        <span key={index} style={{ animationDelay: `-${index * 24}ms` }} />
      ))}
    </span>
  );
}
