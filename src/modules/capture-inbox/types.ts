export type Capture = {
  id: string;
  rawInput: string;
  source: "bookmarklet" | "share" | "paste" | "companion";
  trackId: string | null;
  resolutionState: "pending" | "resolved" | "unresolvable";
  resolutionNotes: string | null;
  triagedAt: string | null;
  triageAction: "added-to-playlist" | "saved" | "for-later" | "dismissed" | null;
  triageTarget: string | null;
  createdAt: string;
};

export type CaptureInput = {
  rawInput: string;
  source: Capture["source"];
};

export type TriageAction =
  | { type: "add-to-playlist"; playlistId: string }
  | { type: "save-to-library" }
  | { type: "for-later" }
  | { type: "dismiss" };
