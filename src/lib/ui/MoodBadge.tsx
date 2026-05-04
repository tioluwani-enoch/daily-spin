import type { AudioFeatures } from "@/lib/db";

export function MoodBadge({ features }: { features: Pick<AudioFeatures, "energy" | "valence" | "tempo"> }) {
  return (
    <div className="flex items-center gap-1.5" aria-label="audio fingerprint">
      <span className="h-2 rounded-full bg-ambient-accent" style={{ width: `${Math.max(10, features.energy * 34)}px` }} />
      <span className="h-2 rounded-full bg-ambient-accent-soft" style={{ width: `${Math.max(10, features.valence * 34)}px` }} />
      <span className="font-mono text-mono-sm text-ambient-muted">{Math.round(features.tempo)} BPM</span>
    </div>
  );
}
