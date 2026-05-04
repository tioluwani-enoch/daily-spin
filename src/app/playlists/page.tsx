import { getCurrentDailySpinUserId } from "@/lib/auth/user";
import { listAllHealth } from "@/modules/playlist-health";
import { PlaylistList } from "@/modules/playlist-health/ui/PlaylistList";

export default async function PlaylistsPage() {
  const playlists = await listAllHealth(await getCurrentDailySpinUserId());

  return (
    <div>
      <p className="font-mono text-mono-sm uppercase text-ambient-muted">Playlist health</p>
      <h1 className="mt-2 text-display text-ambient-fg">Keep the gardens in shape.</h1>
      <div className="mt-10">
        <PlaylistList playlists={playlists} />
      </div>
    </div>
  );
}
