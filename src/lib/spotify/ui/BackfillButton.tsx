"use client";

import { DatabaseZap } from "lucide-react";
import { useState } from "react";

import { Button, Card } from "@/lib/ui";

type BackfillResult = {
  savedTracks: number;
  listeningHistory: number;
  playlists: number;
  playlistTracks: number;
  skippedPlaylists: number;
  audioFeatures: {
    requested: number;
    stored: number;
    unavailable: boolean;
    status: number | null;
  };
  morningPickComputed: boolean;
};

export function BackfillButton() {
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function runBackfill() {
    setStatus("running");
    setMessage("Syncing your Spotify library into Supabase. Keep this tab open.");

    const response = await fetch("/api/spotify/backfill", {
      method: "POST"
    });
    const payload = (await response.json()) as { result?: BackfillResult; error?: string };

    if (!response.ok || !payload.result) {
      setStatus("error");
      setMessage(payload.error ?? "Backfill failed.");
      return;
    }

    const result = payload.result;
    setStatus("done");
    setMessage(
      `Synced ${result.savedTracks} saved tracks, ${result.playlists} playlists, ${result.playlistTracks} playlist tracks, and ${result.listeningHistory} recent plays. ${
        result.skippedPlaylists > 0 ? `Skipped ${result.skippedPlaylists} inaccessible playlists. ` : ""
      }${
        result.audioFeatures.unavailable
          ? `Spotify audio features were unavailable (${result.audioFeatures.status}).`
          : `Stored ${result.audioFeatures.stored} audio feature rows.`
      } ${result.morningPickComputed ? "Morning Pick is ready." : "Morning Pick needs more synced signal."}`
    );
    window.dispatchEvent(new CustomEvent("daily-spin:backfill-complete"));
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-mono-sm uppercase text-ambient-muted">Library backfill</p>
          <h2 className="mt-1 text-h2 text-ambient-fg">Sync your real Spotify data</h2>
          <p className="mt-2 text-meta text-ambient-muted">This writes saved tracks, recent plays, playlists, playlist tracks, and today&apos;s pick into Supabase.</p>
        </div>
        <Button type="button" variant="accent" onClick={runBackfill} disabled={status === "running"}>
          <DatabaseZap className="h-4 w-4" strokeWidth={1.5} />
          {status === "running" ? "Syncing" : "Run backfill"}
        </Button>
      </div>
      {message ? <p className="mt-4 text-meta text-ambient-muted">{message}</p> : null}
    </Card>
  );
}
