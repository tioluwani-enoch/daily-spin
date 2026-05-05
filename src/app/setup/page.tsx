import { SpotifyConnectButton } from "@/lib/auth/ui/SpotifyConnectButton";
import { BackfillButton } from "@/lib/spotify/ui/BackfillButton";
import { LibraryPreview } from "@/lib/spotify/ui/LibraryPreview";
import { WatchlistManager } from "@/modules/artist-watchlist/ui/WatchlistManager";

export default function SetupPage() {
  return (
    <div className="grid gap-8">
      <section>
        <p className="font-mono text-mono-sm uppercase text-ambient-muted">Setup</p>
        <h1 className="mt-2 max-w-2xl text-h1 text-ambient-fg sm:text-display">Connect the pipes quietly.</h1>
        <p className="mt-3 max-w-2xl text-body text-ambient-muted">
          Spotify login, library checks, and Supabase backfill live here so the morning ritual can stay calm.
        </p>
        <div className="mt-6">
          <SpotifyConnectButton />
        </div>
      </section>
      <BackfillButton />
      <WatchlistManager />
      <LibraryPreview />
    </div>
  );
}
