import { getRecentReleases } from "@/modules/artist-watchlist";
import { NewReleasesRow } from "@/modules/artist-watchlist/ui/NewReleasesRow";
import { listUntriaged } from "@/modules/capture-inbox";
import { InboxSection } from "@/modules/capture-inbox/ui/InboxSection";
import { getTodayPick } from "@/modules/morning-pick";
import { MorningPickCard } from "@/modules/morning-pick/ui/MorningPickCard";
import { listAllHealth } from "@/modules/playlist-health";
import { PlaylistList } from "@/modules/playlist-health/ui/PlaylistList";

import { SpotifyConnectButton } from "@/lib/auth/ui/SpotifyConnectButton";
import { getCurrentDailySpinUserId } from "@/lib/auth/user";

export default async function HomePage() {
  const userId = await getCurrentDailySpinUserId();
  const [pick, releases, captures, playlists] = await Promise.all([
    getTodayPick(userId),
    getRecentReleases(userId, { limit: 5 }),
    listUntriaged(userId),
    listAllHealth(userId)
  ]);

  return (
    <div className="grid gap-12">
      <section>
        <p className="font-mono text-mono-sm uppercase text-ambient-muted">Morning ritual</p>
        <h1 className="mt-2 max-w-2xl text-display text-ambient-fg">A small room for today&apos;s listening.</h1>
        <div className="mt-6">
          <SpotifyConnectButton />
        </div>
      </section>
      <MorningPickCard pick={pick} />
      <NewReleasesRow releases={releases} />
      <InboxSection captures={captures} />
      <section className="pt-2">
        <div className="mb-4">
          <p className="font-mono text-mono-sm uppercase text-ambient-muted">Playlist health</p>
          <h2 className="mt-1 text-h2 text-ambient-fg">Attention needed</h2>
        </div>
        <PlaylistList playlists={playlists} />
      </section>
    </div>
  );
}
