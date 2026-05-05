import { Archive, Check, CircleDashed, Music2 } from "lucide-react";

import { Button, Card, Tag } from "@/lib/ui";

import { PasteField } from "./PasteField";

import type { Capture } from "../types";

export function InboxSection({ captures }: { captures: Capture[] }) {
  return (
    <section>
      <div className="mb-4">
        <p className="font-mono text-mono-sm uppercase text-ambient-muted">Capture inbox</p>
        <h2 className="mt-1 text-h2 text-ambient-fg">Songs that should not get lost</h2>
      </div>
      <Card>
        <PasteField />
        <div className="mt-6 grid gap-4">
          {captures.map((capture) => (
            <div key={capture.id} className="border-t border-ambient-edge pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-start gap-3">
                <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded border border-ambient-edge bg-ambient-alt">
                  {capture.resolutionState === "resolved" ? (
                    <Music2 className="h-4 w-4 text-ambient-accent" strokeWidth={1.5} />
                  ) : (
                    <CircleDashed className="h-4 w-4 text-ambient-muted" strokeWidth={1.5} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-body text-ambient-fg">{capture.rawInput}</p>
                    <Tag>{capture.source}</Tag>
                  </div>
                  {capture.resolutionNotes ? <p className="mt-1 text-meta text-ambient-muted">{capture.resolutionNotes}</p> : null}
                  <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                    <form action="/api/captures/triage" method="post">
                      <input type="hidden" name="captureId" value={capture.id} />
                      <input type="hidden" name="action" value="for-later" />
                      <Button type="submit" variant="ghost">
                        <Archive className="h-4 w-4" strokeWidth={1.5} />
                        For later
                      </Button>
                    </form>
                    <form action="/api/captures/triage" method="post">
                      <input type="hidden" name="captureId" value={capture.id} />
                      <input type="hidden" name="action" value="dismiss" />
                      <Button type="submit" variant="quiet">
                        <Check className="h-4 w-4" strokeWidth={1.5} />
                        Dismiss
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {captures.length === 0 ? <p className="text-meta text-ambient-muted">Nothing waiting. Good, quiet inbox.</p> : null}
        </div>
      </Card>
    </section>
  );
}
