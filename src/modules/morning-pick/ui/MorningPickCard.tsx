import { ExternalLink, RotateCcw } from "lucide-react";

import { Button, Card, Tag } from "@/lib/ui";

import type { MorningPick } from "../types";
import { MorningPickPlayButton } from "./MorningPickPlayButton";

export function MorningPickCard({ pick }: { pick: MorningPick | null }) {
  if (!pick) {
    return (
      <Card>
        <p className="font-mono text-mono-sm uppercase text-ambient-muted">Today&apos;s pick</p>
        <h2 className="mt-3 text-h2 text-ambient-fg">Library backfill is warming up.</h2>
        <p className="mt-2 text-meta text-ambient-muted">Once saved tracks and audio features are synced, this space will surface one ignored track each morning.</p>
      </Card>
    );
  }

  return (
    <Card className="group">
      <div className="flex items-start gap-4">
        {pick.imageUrl ? (
          <img className="h-16 w-16 shrink-0 rounded-md border border-ambient-edge object-cover transition group-hover:scale-[1.02]" src={pick.imageUrl} alt="" />
        ) : (
          <div className="h-16 w-16 shrink-0 rounded-md border border-ambient-edge bg-ambient-alt" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-mono-sm uppercase text-ambient-muted">Today&apos;s pick</p>
            <Tag>{pick.pickDate}</Tag>
          </div>
          <h2 className="mt-3 text-h1 text-ambient-fg">{pick.trackName ?? "Track metadata is syncing."}</h2>
          <p className="truncate font-mono text-mono-sm text-ambient-muted">{pick.artists.length > 0 ? pick.artists.join(", ") : pick.trackId}</p>
          <p className="mt-4 text-body text-ambient-fg">{formatPickReason(pick.reason)}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <MorningPickPlayButton pick={pick} />
            <a
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-ambient-edge px-3 py-2 text-meta text-ambient-fg transition hover:border-ambient-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambient-accent"
              href={pick.spotifyUrl ?? `https://open.spotify.com/track/${pick.trackId}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
              Play in Spotify
            </a>
            <form action="/api/morning-pick/dismiss" method="post">
              <input type="hidden" name="pickId" value={pick.id} />
              <Button type="submit" variant="ghost">
                <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
                Randomize
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Card>
  );
}

function formatPickReason(reason: string): string {
  if (reason.startsWith("You saved this track")) {
    return "Daily Spin is still learning your listening patterns, so this is a recommendation to try today. As more Spotify history syncs, these picks will get more personal.";
  }

  return reason;
}
