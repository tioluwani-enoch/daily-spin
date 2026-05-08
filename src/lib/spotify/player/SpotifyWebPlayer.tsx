"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ListMusic, Maximize2, Minimize2, Pause, Play, SkipBack, SkipForward, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type TouchEvent } from "react";

import { Button } from "@/lib/ui";

type PlayerStatus = "idle" | "loading" | "ready" | "error";

type PlayTrackPayload = {
  uri: string;
  queueUris?: string[];
  queueTracks?: QueueTrack[];
  queueIndex?: number;
  name?: string;
  artists?: string[];
  album?: string;
  imageUrl?: string | null;
  audioFeatures?: PlayerAudioFeatures | null;
};

type PlayTrackEvent = CustomEvent<PlayTrackPayload>;

type QueueTrack = {
  uri: string;
  name: string;
  artists: string[];
  album: string;
  imageUrl: string | null;
  audioFeatures?: PlayerAudioFeatures | null;
};

type PlayerAudioFeatures = {
  energy: number;
  valence?: number;
  tempo: number;
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
  const queueIndexRef = useRef(0);

  useEffect(() => {
    queueUrisRef.current = queueUris;
  }, [queueUris]);

  useEffect(() => {
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);

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
          offset: normalizedIndex,
          transfer: false
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

  const togglePlayback = useCallback(() => {
    setIsPaused((paused) => !paused);
    const togglePromise = playerRef.current?.togglePlay();
    void togglePromise?.catch(() => {
      setIsPaused((paused) => !paused);
      setStatus("error");
      setMessage("Spotify did not respond to that play command. Try again in a moment.");
    });
  }, []);

  const previousTrack = useCallback(() => {
    if (queueUris.length > 1) {
      void playQueueIndex(queueIndex - 1);
      return;
    }

    void playerRef.current?.previousTrack();
  }, [playQueueIndex, queueIndex, queueUris.length]);

  const nextTrack = useCallback(() => {
    if (queueUris.length > 1) {
      void playQueueIndex(queueIndex + 1);
      return;
    }

    void playerRef.current?.nextTrack();
  }, [playQueueIndex, queueIndex, queueUris.length]);

  const moveQueueTrack = useCallback(
    (fromIndex: number, direction: -1 | 1) => {
      if (queueUris.length < 2) {
        return;
      }

      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= queueUris.length) {
        return;
      }

      const currentIndex = queueIndexRef.current;
      if (fromIndex === currentIndex || toIndex === currentIndex) {
        return;
      }

      const nextUris = moveItem(queueUris, fromIndex, toIndex);
      const nextTracks = moveItem(queueTracks, fromIndex, toIndex);
      const currentUri = queueUris[queueIndexRef.current];
      const nextCurrentIndex = Math.max(0, nextUris.findIndex((uri) => uri === currentUri));

      setQueueUris(nextUris);
      setQueueTracks(nextTracks);
      setQueueIndex(nextCurrentIndex);
    },
    [queueTracks, queueUris]
  );

  const miniArtUrl = currentTrack?.album.images[0]?.url ?? pendingTrack?.imageUrl ?? "";
  const motion = getPlayerMotion(queueTracks[queueIndex]?.audioFeatures ?? pendingTrack?.audioFeatures ?? null);

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
            onPrevious={previousTrack}
            onToggle={togglePlayback}
            onNext={nextTrack}
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
          motion={motion}
          onClose={() => setIsExpanded(false)}
          onPrevious={previousTrack}
          onToggle={togglePlayback}
          onNext={nextTrack}
          onSelectQueueTrack={playQueueIndex}
          onMoveQueueTrack={moveQueueTrack}
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
    const metadataByUri = new Map((payload.queueTracks ?? []).map((track) => [track.uri, track]));
    const shouldPreserveOrder = metadataByUri.size > 0;
    const resolvedUris = shouldPreserveOrder ? queueAroundCurrent(payload.queueUris, payload.uri) : shuffleQueueAroundCurrent(payload.queueUris, payload.uri);

    return {
      uris: resolvedUris,
      index: Math.max(0, resolvedUris.findIndex((uri) => uri === payload.uri)),
      tracks: resolvedUris.map((uri, index) =>
        uri === payload.uri
          ? payloadToQueueTrack(payload)
          : metadataByUri.get(uri) ?? {
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

function queueAroundCurrent(values: string[], currentUri: string): string[] {
  const currentIndex = values.findIndex((uri) => uri === currentUri);
  if (currentIndex <= 0) {
    return values;
  }

  return [...values.slice(currentIndex), ...values.slice(0, currentIndex)];
}

function payloadToQueueTrack(payload: PlayTrackPayload): QueueTrack {
  return {
    uri: payload.uri,
    name: payload.name ?? "Daily Spin track",
    artists: payload.artists ?? [],
    album: payload.album ?? "Daily Spin",
    imageUrl: payload.imageUrl ?? null,
    audioFeatures: payload.audioFeatures ?? null
  };
}

function queueTrackToPayload(track: QueueTrack): PlayTrackPayload {
  return {
    uri: track.uri,
    name: track.name,
    artists: track.artists,
    album: track.album,
    imageUrl: track.imageUrl,
    audioFeatures: track.audioFeatures ?? null
  };
}

type PlayerMotion = {
  beatMs: number;
  energy: number;
  valence: number;
};

function getPlayerMotion(features: PlayerAudioFeatures | null): PlayerMotion {
  const tempo = features?.tempo && features.tempo > 0 ? features.tempo : 96;
  const beatMs = Math.round(Math.min(900, Math.max(360, 60_000 / tempo)));

  return {
    beatMs,
    energy: clamp01(features?.energy ?? 0.55),
    valence: clamp01(features?.valence ?? 0.5)
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
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
  motion,
  onClose,
  onPrevious,
  onToggle,
  onNext,
  onSelectQueueTrack,
  onMoveQueueTrack
}: {
  track: SpotifyTrackWindow | null;
  pendingTrack: PlayTrackEvent["detail"] | null;
  isPaused: boolean;
  queueUris: string[];
  queueTracks: QueueTrack[];
  queueIndex: number;
  position: number;
  duration: number;
  motion: PlayerMotion;
  onClose: () => void;
  onPrevious: () => void;
  onToggle: () => void;
  onNext: () => void;
  onSelectQueueTrack: (index: number) => void;
  onMoveQueueTrack: (index: number, direction: -1 | 1) => void;
}) {
  const [panel, setPanel] = useState<"now" | "queue">("now");
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const imageUrl = track?.album.images[0]?.url ?? pendingTrack?.imageUrl ?? "";
  const trackName = track?.name ?? pendingTrack?.name ?? "Preparing track";
  const artists = track ? track.artists.map((artist) => artist.name).join(", ") : pendingTrack?.artists?.join(", ") ?? "Spotify is connecting";
  const album = track?.album.name ?? pendingTrack?.album ?? "Daily Spin";
  const hasQueue = queueUris.length > 1;
  const visualStyle = {
    "--player-beat-ms": `${motion.beatMs}ms`,
    "--player-slow-beat-ms": `${motion.beatMs * 2}ms`,
    "--player-energy": motion.energy,
    "--player-valence": motion.valence,
    "--player-glow-low": 0.42 + motion.energy * 0.18,
    "--player-glow-high": 0.62 + motion.energy * 0.28,
    "--player-glow-scale": 0.98 + motion.energy * 0.08,
    "--player-shell-glow-size": `${4 + motion.energy * 3}rem`,
    "--player-shell-glow-opacity": 0.12 + motion.energy * 0.1
  } as CSSProperties;

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (startX === null || startY === null || !hasQueue) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaX) < 54 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) {
      return;
    }

    setPanel(deltaX < 0 ? "queue" : "now");
  };

  return (
    <div className="player-visual-root fixed inset-0 z-50 overflow-hidden bg-black/35 backdrop-blur-xl" style={visualStyle}>
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-3xl"
        style={{
          backgroundImage: imageUrl ? `url(${imageUrl})` : undefined
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.24),rgba(31,27,23,0.74))]" />
      <div className={`player-beat-glow ${isPaused ? "player-beat-glow-paused" : ""}`} />

      <div className="absolute inset-x-0 top-[38%] -translate-y-1/2 pointer-events-none">
        <WaveBars isPaused={isPaused} motion={motion} />
      </div>

      <section
        className="player-modal-shell absolute inset-x-3 top-1/2 flex h-[min(92dvh,54rem)] -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-white/25 bg-white/18 p-4 text-white shadow-ambient backdrop-blur-2xl sm:left-1/2 sm:right-auto sm:w-[min(34rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:p-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="absolute inset-x-0 top-0 h-24 opacity-60 blur-2xl"
          style={{
            backgroundImage: imageUrl ? `linear-gradient(90deg, transparent, rgba(255,255,255,0.36), transparent), url(${imageUrl})` : undefined,
            backgroundSize: "cover"
          }}
        />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex rounded-md border border-white/20 bg-black/10 p-1">
            <button
              className={`rounded px-3 py-1.5 font-mono text-mono-sm uppercase transition ${panel === "now" ? "bg-white text-black" : "text-white/72 hover:text-white"}`}
              type="button"
              onClick={() => setPanel("now")}
            >
              Now
            </button>
            <button
              className={`inline-flex items-center gap-2 rounded px-3 py-1.5 font-mono text-mono-sm uppercase transition disabled:opacity-40 ${
                panel === "queue" ? "bg-white text-black" : "text-white/72 hover:text-white"
              }`}
              type="button"
              onClick={() => setPanel("queue")}
              disabled={!hasQueue}
            >
              <ListMusic className="h-4 w-4" strokeWidth={1.5} />
              Up next
            </button>
          </div>
          <button className="rounded-md border border-white/30 p-2 text-white/85 transition hover:text-white" type="button" onClick={onClose} aria-label="Close player">
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="relative mt-4 min-h-0 flex-1 overflow-hidden">
          <div className="flex h-full transition-transform duration-300 ease-out" style={{ transform: panel === "queue" ? "translateX(-100%)" : "translateX(0)" }}>
            <div className="player-now-panel flex h-full min-w-full flex-col">
              <div className="player-now-content min-h-0 flex-1 overflow-hidden">
                {imageUrl ? (
                  <img
                    className="player-artwork mx-auto aspect-square max-h-[42dvh] w-full rounded-md border border-white/25 object-cover shadow-ambient sm:max-h-[46dvh]"
                    src={imageUrl}
                    alt=""
                  />
                ) : null}
                <div className="player-track-copy mt-4">
                  <p className="font-mono text-mono-sm uppercase text-white/70">Now playing</p>
                  <h2 className="player-track-title mt-2 break-words text-[clamp(1.75rem,7vw,2.75rem)] font-semibold leading-[1.08] text-white">{trackName}</h2>
                  <p className="mt-3 break-words font-mono text-mono-sm text-white/78">{artists}</p>
                  <p className="mt-1 break-words text-meta text-white/68">{album}</p>
                </div>
              </div>

              <div className="player-controls-zone shrink-0 pt-4">
                <ProgressBar position={position} duration={duration} />
                <div className="mt-4 grid grid-cols-[auto_1fr_auto_auto] items-center gap-3">
                  <button className="rounded-md border border-white/25 bg-white/10 p-3 transition active:scale-95 hover:bg-white/18" type="button" onClick={onPrevious} aria-label="Previous track">
                    <SkipBack className="h-5 w-5" strokeWidth={1.5} />
                  </button>
                  <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-5 text-meta text-black transition active:scale-[0.98] hover:bg-white/85" type="button" onClick={onToggle}>
                    {isPaused ? <Play className="h-5 w-5" strokeWidth={1.5} /> : <Pause className="h-5 w-5" strokeWidth={1.5} />}
                    {isPaused ? "Play" : "Pause"}
                  </button>
                  <button className="rounded-md border border-white/25 bg-white/10 p-3 transition active:scale-95 hover:bg-white/18" type="button" onClick={onNext} aria-label="Next track">
                    <SkipForward className="h-5 w-5" strokeWidth={1.5} />
                  </button>
                  <button className="rounded-md border border-white/25 bg-white/10 p-3 transition active:scale-95 hover:bg-white/18" type="button" onClick={onClose} aria-label="Minimize player">
                    <Minimize2 className="h-5 w-5" strokeWidth={1.5} />
                  </button>
                </div>
                {hasQueue ? (
                  <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-black/10 px-4 py-2 font-mono text-mono-sm uppercase text-white/78 transition hover:bg-white/12 hover:text-white" type="button" onClick={() => setPanel("queue")}>
                    Swipe left for up next
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                ) : null}
              </div>
            </div>

            <aside className="flex h-full min-w-full flex-col pl-0">
              <div className="flex items-center justify-between gap-3 pb-4">
                <button className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-black/10 px-3 py-2 font-mono text-mono-sm uppercase text-white/78 transition hover:bg-white/12 hover:text-white" type="button" onClick={() => setPanel("now")}>
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                  Now playing
                </button>
                <p className="font-mono text-mono-sm text-white/52">{queueIndex + 1} of {queueUris.length}</p>
              </div>
              <div className="player-queue-scroll min-h-0 flex-1 overflow-y-auto pr-1">
                {queueUris.map((uri, index) => {
                  const item = queueTracks[index];
                  const isCurrent = index === queueIndex;

                  return (
                    <div
                      key={`${uri}-${index}`}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition ${
                        isCurrent ? "bg-white text-black" : "text-white/78 hover:bg-white/12 hover:text-white"
                      }`}
                    >
                      <button
                        className="min-w-0 flex flex-1 items-center gap-3 text-left"
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
                      <span className="grid shrink-0 grid-cols-2 gap-1">
                        <button
                          className={`rounded border p-1 transition disabled:cursor-not-allowed disabled:opacity-35 ${
                            isCurrent ? "border-black/20 hover:bg-black/10" : "border-white/18 hover:bg-white/12"
                          }`}
                          type="button"
                          onClick={() => onMoveQueueTrack(index, -1)}
                          disabled={index === 0 || index === queueIndex || index - 1 === queueIndex}
                          aria-label={`Move ${item?.name ?? `track ${index + 1}`} up`}
                        >
                          <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                        <button
                          className={`rounded border p-1 transition disabled:cursor-not-allowed disabled:opacity-35 ${
                            isCurrent ? "border-black/20 hover:bg-black/10" : "border-white/18 hover:bg-white/12"
                          }`}
                          type="button"
                          onClick={() => onMoveQueueTrack(index, 1)}
                          disabled={index === queueUris.length - 1 || index === queueIndex || index + 1 === queueIndex}
                          aria-label={`Move ${item?.name ?? `track ${index + 1}`} down`}
                        >
                          <ChevronDown className="h-4 w-4" strokeWidth={1.5} />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}

function WaveBars({ isPaused, motion }: { isPaused: boolean; motion: PlayerMotion }) {
  return (
    <span className={`wave-bars ${isPaused ? "wave-bars-paused" : ""}`} aria-hidden="true">
      {Array.from({ length: 120 }).map((_, index) => (
        <span key={index} style={getWaveBarStyle(index, motion)} />
      ))}
    </span>
  );
}

function getWaveBarStyle(index: number, motion: PlayerMotion): CSSProperties {
  const centerDistance = Math.abs(index - 59.5) / 59.5;
  const envelope = 1 - centerDistance ** 1.65;
  const ripple = (Math.sin(index * 0.42) + 1) / 2;
  const base = 0.18 + envelope * 0.42 + ripple * 0.12;
  const peak = base + motion.energy * (0.42 + envelope * 0.46);

  return {
    "--bar-rest": (base * 0.72).toFixed(3),
    "--bar-mid": Math.min(1, base + motion.energy * 0.12).toFixed(3),
    "--bar-peak": Math.min(1, peak).toFixed(3),
    "--bar-paused": (base * 0.45).toFixed(3),
    "--bar-opacity": (0.18 + Math.min(1, peak) * 0.58).toFixed(3),
    animationDelay: `-${Math.round(index * motion.beatMs * 0.026)}ms`
  } as CSSProperties;
}
