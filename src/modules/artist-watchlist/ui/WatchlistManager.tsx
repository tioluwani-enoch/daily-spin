"use client";

import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button, Card } from "@/lib/ui";

import type { WatchlistArtist } from "../types";

type WatchlistResponse = {
  watchlist?: WatchlistArtist[];
  seeds?: WatchlistArtist[];
  error?: string;
};

export function WatchlistManager() {
  const [watchlist, setWatchlist] = useState<WatchlistArtist[]>([]);
  const [seeds, setSeeds] = useState<WatchlistArtist[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");

  const loadWatchlist = useCallback(async () => {
    setStatus("loading");
    setMessage("");

    const response = await fetch("/api/watchlist");
    const payload = (await response.json()) as WatchlistResponse;

    if (!response.ok || !payload.watchlist || !payload.seeds) {
      setStatus("error");
      setMessage(payload.error ?? "Could not load watchlist artists yet.");
      return;
    }

    setWatchlist(payload.watchlist);
    setSeeds(payload.seeds);
    setStatus("idle");
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  async function updateWatchlist(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    setStatus("saving");
    setMessage("");

    const response = await fetch("/api/watchlist", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as WatchlistResponse;

    if (!response.ok || !payload.watchlist || !payload.seeds) {
      setStatus("error");
      setMessage(payload.error ?? "Watchlist update failed.");
      return;
    }

    setWatchlist(payload.watchlist);
    setSeeds(payload.seeds);
    setStatus("idle");
    setMessage(method === "POST" ? "Artist added. Run backfill to check for new releases." : "");
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-mono-sm uppercase text-ambient-muted">Artist watchlist</p>
          <h2 className="mt-1 text-h2 text-ambient-fg">Choose who Daily Spin should watch</h2>
          <p className="mt-2 text-meta text-ambient-muted">Suggestions come from artists already in your synced saved tracks.</p>
        </div>
        <Button type="button" variant="ghost" onClick={loadWatchlist} disabled={status === "loading" || status === "saving"}>
          <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
          Refresh
        </Button>
      </div>

      {message ? <p className="mt-4 text-meta text-ambient-muted">{message}</p> : null}

      {watchlist.length > 0 ? (
        <div className="mt-5 grid gap-3">
          {watchlist.map((artist) => (
            <div key={artist.artistId} className="flex items-center gap-3 rounded-md border border-ambient-edge p-3">
              <ArtistImage artist={artist} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-meta text-ambient-fg">{artist.name}</span>
                <label className="mt-1 flex items-center gap-2 font-mono text-mono-sm text-ambient-muted">
                  <input
                    type="checkbox"
                    checked={artist.includeCompilations}
                    onChange={(event) =>
                      updateWatchlist("PATCH", {
                        artistId: artist.artistId,
                        includeCompilations: event.currentTarget.checked
                      })
                    }
                  />
                  Include compilations
                </label>
              </span>
              <button
                className="rounded-md border border-ambient-edge p-2 text-ambient-muted transition hover:border-ambient-accent hover:text-ambient-accent"
                type="button"
                onClick={() => updateWatchlist("DELETE", { artistId: artist.artistId })}
                aria-label={`Remove ${artist.name}`}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-md border border-ambient-edge p-4 text-meta text-ambient-muted">
          No artists watched yet. Add a few suggestions, then run backfill so Daily Spin can check their releases.
        </p>
      )}

      <div className="mt-6">
        <p className="font-mono text-mono-sm uppercase text-ambient-muted">Suggested artists</p>
        {seeds.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {seeds.map((artist) => (
              <button
                key={artist.artistId}
                className="flex items-center gap-3 rounded-md border border-ambient-edge p-3 text-left transition hover:border-ambient-accent"
                type="button"
                onClick={() => updateWatchlist("POST", { artistId: artist.artistId })}
                disabled={status === "saving"}
              >
                <ArtistImage artist={artist} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-meta text-ambient-fg">{artist.name}</span>
                  <span className="block font-mono text-mono-sm text-ambient-muted">Watch releases</span>
                </span>
                <Plus className="h-4 w-4 text-ambient-muted" strokeWidth={1.5} />
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-meta text-ambient-muted">Run backfill first so Daily Spin can suggest artists from your saved tracks.</p>
        )}
      </div>
    </Card>
  );
}

function ArtistImage({ artist }: { artist: WatchlistArtist }) {
  return artist.imageUrl ? (
    <img className="h-12 w-12 shrink-0 rounded-md border border-ambient-edge object-cover" src={artist.imageUrl} alt="" />
  ) : (
    <span className="h-12 w-12 shrink-0 rounded-md border border-ambient-edge bg-ambient-alt" />
  );
}
