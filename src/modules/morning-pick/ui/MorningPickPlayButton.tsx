"use client";

import { Play } from "lucide-react";

import type { MorningPick } from "../types";

export function MorningPickPlayButton({ pick }: { pick: MorningPick }) {
  return (
    <button
      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-ambient-accent px-3 py-2 text-meta text-white transition hover:bg-ambient-accent-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambient-accent sm:w-auto"
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent("daily-spin:play-track", {
            detail: {
              uri: `spotify:track:${pick.trackId}`,
              queueUris: [`spotify:track:${pick.trackId}`],
              queueIndex: 0,
              name: pick.trackName ?? "Daily Spin pick",
              artists: pick.artists,
              album: pick.albumName ?? undefined,
              imageUrl: pick.imageUrl
            }
          })
        );
      }}
    >
      <Play className="h-4 w-4" strokeWidth={1.5} />
      Play here
    </button>
  );
}
