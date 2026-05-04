export type CompanionToolName =
  | "search_library"
  | "get_listening_history"
  | "explain_morning_pick"
  | "get_playlist_health"
  | "propose_playlist_additions"
  | "propose_playlist_removals"
  | "add_track_to_playlist"
  | "remove_track_from_playlist"
  | "find_in_inbox"
  | "triage_capture"
  | "compose_session_playlist"
  | "summarize_week";

export type CompanionToolDefinition = {
  name: CompanionToolName;
  description: string;
};

export const companionTools: CompanionToolDefinition[] = [
  { name: "search_library", description: "Find saved tracks matching a query or feature filter." },
  { name: "get_listening_history", description: "Retrieve recent plays in a time window." },
  { name: "explain_morning_pick", description: "Return the structured reason for today's pick." },
  { name: "get_playlist_health", description: "Get drift score and health label for a playlist." },
  { name: "propose_playlist_additions", description: "Suggest saved tracks that fit a playlist fingerprint." },
  { name: "propose_playlist_removals", description: "Surface outlier tracks in a playlist." },
  { name: "add_track_to_playlist", description: "Request confirmation to add a track to a playlist." },
  { name: "remove_track_from_playlist", description: "Request confirmation to remove a track from a playlist." },
  { name: "find_in_inbox", description: "Look at the user's capture inbox." },
  { name: "triage_capture", description: "Request confirmation to triage a capture." },
  { name: "compose_session_playlist", description: "Build a temporary playlist from the user's taste graph." },
  { name: "summarize_week", description: "Build data for the Sunday recap." }
];
