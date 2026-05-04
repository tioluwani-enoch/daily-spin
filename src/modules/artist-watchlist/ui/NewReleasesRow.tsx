import { Disc3, ExternalLink } from "lucide-react";

import { Card, Tag } from "@/lib/ui";

import type { NewRelease } from "../types";

export function NewReleasesRow({ releases }: { releases: NewRelease[] }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-mono-sm uppercase text-ambient-muted">New from your artists</p>
          <h2 className="mt-1 text-h2 text-ambient-fg">Watchlist drops from the last 14 days</h2>
        </div>
        <Tag>{releases.length} fresh</Tag>
      </div>
      <div className="grid gap-3">
        {releases.length === 0 ? (
          <Card className="p-4 shadow-none">
            <p className="text-meta text-ambient-muted">No watchlist releases yet. Spotify sync will fill this with artists you choose.</p>
          </Card>
        ) : null}
        {releases.map((release) => (
          <Card key={release.id} className="p-4 shadow-none">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded border border-ambient-edge bg-ambient-alt">
                <Disc3 className="h-5 w-5 text-ambient-muted" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-h2 text-ambient-fg">{release.album.name}</h3>
                  <Tag>{release.album.type}</Tag>
                </div>
                <p className="font-mono text-mono-sm text-ambient-muted">{release.album.releaseDate}</p>
              </div>
              <a
                aria-label={`Open ${release.album.name} in Spotify`}
                className="rounded-md p-2 text-ambient-muted transition hover:text-ambient-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambient-accent"
                href="https://open.spotify.com"
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
              </a>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
