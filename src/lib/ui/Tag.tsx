import type { ReactNode } from "react";

export function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-ambient-edge px-2 py-1 font-mono text-mono-sm text-ambient-muted">{children}</span>;
}
