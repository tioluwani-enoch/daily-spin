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
  const [queueIndex, setQueueIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    queueUrisRef.current = queueUris;
  }, [queueUris]);

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
        setMessage(errorMessage);
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
    [deviceId, queueUris]
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
      <aside className="fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-ambient-edge bg-ambient-surface shadow-ambient backdrop-blur-xl">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-12 blur-2xl"
          style={{ backgroundImage: miniArtUrl ? `url(${miniArtUrl})` : undefined }}
        />
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
          onClose={() => setIsExpanded(false)}
          onPrevious={() => (queueUris.length > 1 ? playQueueIndex(queueIndex - 1) : playerRef.current?.previousTrack())}
          onToggle={() => playerRef.current?.togglePlay()}
          onNext={() => (queueUris.length > 1 ? playQueueIndex(queueIndex + 1) : playerRef.current?.nextTrack())}
        />
      ) : null}
    </>
  );
}

async function resolvePlaybackQueue(payload: PlayTrackPayload): Promise<{
  uris: string[];
  index: number;
  pendingTrack: PlayTrackPayload;
}> {
  if (payload.queueUris && payload.queueUris.length > 1) {
    return {
      uris: payload.queueUris,
      index: payload.queueIndex ?? Math.max(0, payload.queueUris.findIndex((uri) => uri === payload.uri)),
      pendingTrack: payload
    };
  }

  try {
    const response = await fetch("/api/spotify/library-preview");
    const data = (await response.json()) as { tracks?: QueueTrack[] };
    const tracks = data.tracks ?? [];
    const previewUris = tracks.map((track) => track.uri).filter(Boolean);
    const queueUris = uniqueStrings(previewUris.includes(payload.uri) ? previewUris : [payload.uri, ...previewUris]);
    const selectedTrack = tracks.find((track) => track.uri === payload.uri);

    return {
      uris: queueUris.length > 0 ? queueUris : [payload.uri],
      index: Math.max(0, queueUris.findIndex((uri) => uri === payload.uri)),
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
      pendingTrack: payload
    };
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
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
    <div className="mt-3 flex flex-wrap items-center gap-2">
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
  onClose,
  onPrevious,
  onToggle,
  onNext
}: {
  track: SpotifyTrackWindow | null;
  pendingTrack: PlayTrackEvent["detail"] | null;
  isPaused: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onToggle: () => void;
  onNext: () => void;
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

      <section className="absolute left-1/2 top-1/2 flex max-h-[92vh] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-white/25 bg-white/18 p-5 text-white shadow-ambient backdrop-blur-2xl sm:p-8">
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

        <div className="relative grid gap-7">
          {imageUrl ? <img className="aspect-square w-full rounded-md border border-white/25 object-cover shadow-ambient" src={imageUrl} alt="" /> : null}
          <div className="min-w-0">
            <p className="font-mono text-mono-sm uppercase text-white/70">Now playing</p>
            <h2 className="mt-3 text-display text-white">{trackName}</h2>
            <p className="mt-2 truncate font-mono text-mono-sm text-white/72">{artists}</p>
            <p className="mt-1 truncate text-meta text-white/62">{album}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
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
              <button className="ml-auto rounded-md border border-white/25 bg-white/10 p-3 transition hover:bg-white/18" type="button" onClick={onClose} aria-label="Minimize player">
                <Minimize2 className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
