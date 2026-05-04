import Link from "next/link";

import { Card } from "@/lib/ui";

import { HealthBadge } from "./HealthBadge";

import type { PlaylistHealth } from "../types";

export function PlaylistList({ playlists }: { playlists: PlaylistHealth[] }) {
  return (
    <div className="grid gap-3">
      {playlists.length === 0 ? (
        <Card className="p-4 shadow-none">
          <p className="text-meta text-ambient-muted">No synced playlists yet. Once Spotify backfill runs, playlist health will show your real playlists here.</p>
        </Card>
      ) : null}
      {playlists.map((playlist) => (
        <Link key={playlist.playlistId} href={`/playlists/${playlist.playlistId}`}>
          <Card className="p-4 shadow-none transition hover:border-ambient-accent">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-h2 text-ambient-fg">{playlist.name}</h2>
                <p className="font-mono text-mono-sm text-ambient-muted">
                  {playlist.trackCount} tracks &middot; drift {playlist.driftScore.toFixed(2)}
                </p>
              </div>
              <HealthBadge label={playlist.healthLabel} />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
