import { CurationView } from "@/modules/playlist-health/ui/CurationView";
import { getHealth, proposeAdditions, proposeRemovals } from "@/modules/playlist-health";

export default async function PlaylistPage({ params }: { params: { playlistId: string } }) {
  const [health, additions, removals] = await Promise.all([
    getHealth(params.playlistId),
    proposeAdditions(params.playlistId, { limit: 3 }),
    proposeRemovals(params.playlistId, { limit: 2 })
  ]);

  return <CurationView health={health} additions={additions} removals={removals} />;
}
