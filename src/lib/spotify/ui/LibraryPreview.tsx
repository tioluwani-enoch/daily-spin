"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button, Card } from "@/lib/ui";

type LibraryPreviewTrack = {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  album: string;
  imageUrl: string | null;
  spotifyUrl: string;
  savedAt: string;
};

export function LibraryPreview() {
  const [tracks, setTracks] = useState<LibraryPreviewTrack[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");

  const loadPreview = useCallback(async () => {
    setStatus("loading");
    setMessage("");

    const response = await fetch("/api/spotify/library-preview");
    const payload = (await response.json()) as { tracks?: LibraryPreviewTrack[]; error?: string };

    if (!response.ok || !payload.tracks) {
      setStatus("error");
      setMessage(payload.error ?? "Could not read Spotify library yet.");
      return;
    }

    setTracks(payload.tracks);
    setStatus("ready");
  }, []);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-mono-sm uppercase text-ambient-muted">Spotify connection</p>
          <h2 className="mt-1 text-h2 text-ambient-fg">Check your saved tracks</h2>
        </div>
        <Button type="button" variant="ghost" onClick={loadPreview} disabled={status === "loading"}>
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
          {status === "loading" ? "Reading" : "Load preview"}
        </Button>
      </div>

      {message ? <p className="mt-4 text-meta text-ambient-muted">{message}</p> : null}

      {tracks.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {tracks.map((track, index) => (
            <div
              key={track.id}
              className="flex items-center gap-3 rounded-md border border-ambient-edge p-3 transition hover:border-ambient-accent"
            >
              {track.imageUrl ? <img className="h-12 w-12 rounded border border-ambient-edge object-cover" src={track.imageUrl} alt="" /> : null}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-meta text-ambient-fg">{track.name}</span>
                <span className="block truncate font-mono text-mono-sm text-ambient-muted">{track.artists.join(", ")}</span>
              </span>
              <button
                className="shrink-0 rounded-md border border-ambient-edge px-3 py-2 text-meta text-ambient-fg transition hover:border-ambient-accent"
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  window.dispatchEvent(
                    new CustomEvent("daily-spin:play-track", {
                      detail: {
                        uri: track.uri,
                        queueUris: tracks.map((item) => item.uri),
                        queueIndex: index,
                        name: track.name,
                        artists: track.artists,
                        album: track.album,
                        imageUrl: track.imageUrl
                      }
                    })
                  );
                }}
              >
                Play here
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
