export type ResolveResult =
  | { state: "resolved"; trackId: string; notes?: undefined }
  | { state: "unresolvable"; trackId?: undefined; notes: string };

const SPOTIFY_TRACK_PATTERNS = [
  /open\.spotify\.com\/track\/([A-Za-z0-9]+)/,
  /spotify:track:([A-Za-z0-9]+)/
];

export function resolveSpotifyTrackId(rawInput: string): ResolveResult {
  for (const pattern of SPOTIFY_TRACK_PATTERNS) {
    const match = rawInput.match(pattern);
    if (match?.[1]) {
      return { state: "resolved", trackId: match[1] };
    }
  }

  if (/https?:\/\//.test(rawInput)) {
    return { state: "unresolvable", notes: "non-Spotify source" };
  }

  if (/\S+\s[-–—]\s\S+/.test(rawInput) || /\S+\s+by\s+\S+/i.test(rawInput)) {
    return { state: "unresolvable", notes: "needs Spotify search credentials" };
  }

  return { state: "unresolvable", notes: "needs a Spotify track URL or Artist - Track text" };
}
