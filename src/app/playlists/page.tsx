import { getCurrentDailySpinUserId } from "@/lib/auth/user";
import { listPlaylistMixSources } from "@/modules/playlist-mixer";
import { PlaylistMixer } from "@/modules/playlist-mixer/ui/PlaylistMixer";
import { listAllHealth } from "@/modules/playlist-health";
import { PlaylistList } from "@/modules/playlist-health/ui/PlaylistList";

export default async function PlaylistsPage() {
  const userId = await getCurrentDailySpinUserId();
  const [playlists, mixSources] = await Promise.all([listAllHealth(userId), listPlaylistMixSources(userId)]);

  return (
    <div className="grid gap-12">
      <section>
        <p className="font-mono text-mono-sm uppercase text-ambient-muted">Playlist mixer</p>
        <h1 className="mt-2 max-w-3xl text-h1 text-ambient-fg sm:text-display">Build from any corner of your library.</h1>
        <div className="mt-8">
          <PlaylistMixer sources={mixSources} />
        </div>
      </section>
      <section>
        <p className="font-mono text-mono-sm uppercase text-ambient-muted">Playlist health</p>
        <h2 className="mt-2 text-h1 text-ambient-fg">Keep the gardens in shape.</h2>
        <div className="mt-6">
          <PlaylistList playlists={playlists} />
        </div>
      </section>
    </div>
  );
}
