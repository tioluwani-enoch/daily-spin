import { clsx } from "clsx";

import type { HealthLabel } from "../types";

export function HealthBadge({ label }: { label: HealthLabel }) {
  return (
    <span
      className={clsx(
        "rounded-full border px-2 py-1 font-mono text-mono-sm",
        label === "healthy" && "border-ambient-edge text-ambient-muted",
        label === "drifting" && "border-ambient-accent text-ambient-accent",
        label === "stale" && "border-ambient-edge text-ambient-fg",
        label === "dying" && "border-ambient-edge text-ambient-muted"
      )}
    >
      {label}
    </span>
  );
}
