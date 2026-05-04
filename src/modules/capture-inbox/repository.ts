import { resolveSpotifyTrackId } from "@/lib/spotify/resolve";
import { nowIso } from "@/lib/utils/date";

import type { Capture, CaptureInput, TriageAction } from "./types";

export async function createCapture(_userId: string, input: CaptureInput): Promise<Capture> {
  const result = resolveSpotifyTrackId(input.rawInput);

  return {
    id: crypto.randomUUID(),
    rawInput: input.rawInput,
    source: input.source,
    trackId: result.state === "resolved" ? result.trackId : null,
    resolutionState: result.state,
    resolutionNotes: result.state === "unresolvable" ? result.notes : null,
    triagedAt: null,
    triageAction: null,
    triageTarget: null,
    createdAt: nowIso()
  };
}

export async function listUntriaged(_userId: string): Promise<Capture[]> {
  return [];
}

export async function listAll(_userId: string, opts: { limit?: number; before?: string } = {}): Promise<Capture[]> {
  void opts;
  return [];
}

export async function resolveCapture(captureId: string): Promise<Capture> {
  void captureId;
  throw new Error("Capture persistence is not wired yet");
}

export async function triageCapture(captureId: string, action: TriageAction): Promise<Capture> {
  const capture = await resolveCapture(captureId);
  const triageAction =
    action.type === "add-to-playlist"
      ? "added-to-playlist"
      : action.type === "save-to-library"
        ? "saved"
        : action.type === "for-later"
          ? "for-later"
          : "dismissed";

  return {
    ...capture,
    triagedAt: nowIso(),
    triageAction,
    triageTarget: action.type === "add-to-playlist" ? action.playlistId : null
  };
}
