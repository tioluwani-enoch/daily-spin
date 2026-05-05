import { Card } from "@/lib/ui";

import { FingerprintRadar } from "./FingerprintRadar";
import { HealthBadge } from "./HealthBadge";

import type { PlaylistHealth, Suggestion } from "../types";

export function CurationView({
  health,
  additions,
  removals
}: {
  health: PlaylistHealth;
  additions: Suggestion[];
  removals: Suggestion[];
}) {
  return (
    <div className="grid gap-8">
      <Card>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words text-h1 text-ambient-fg">{health.name}</h1>
              <HealthBadge label={health.healthLabel} />
            </div>
            <p className="mt-2 text-meta text-ambient-muted">
              Drift {health.driftScore.toFixed(2)} &middot; {health.trackCount} tracks &middot; edited {health.daysSinceLastEdit} days ago
            </p>
          </div>
          <FingerprintRadar core={health.coreCentroid} recent={health.recentCentroid} />
        </div>
      </Card>
      <SuggestionGroup title="Suggested additions" suggestions={additions} />
      <SuggestionGroup title="Possible removals" suggestions={removals} />
    </div>
  );
}

function SuggestionGroup({ title, suggestions }: { title: string; suggestions: Suggestion[] }) {
  return (
    <section>
      <h2 className="mb-3 text-h2 text-ambient-fg">{title}</h2>
      <div className="grid gap-3">
        {suggestions.map((suggestion) => (
          <Card key={`${suggestion.type}-${suggestion.trackId}`} className="p-4 shadow-none">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-all font-mono text-mono-sm text-ambient-muted">{suggestion.trackId}</p>
                <p className="text-meta text-ambient-fg">{suggestion.reason}</p>
              </div>
              <p className="font-mono text-mono-sm text-ambient-muted">{suggestion.fitScore.toFixed(2)}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
