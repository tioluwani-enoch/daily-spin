export {};

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: SpotifyPlayerOptions) => SpotifyPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }

  type SpotifyPlayerOptions = {
    name: string;
    getOAuthToken: (callback: (token: string) => void) => void;
    volume?: number;
  };

  type SpotifyTrackWindow = {
    id: string;
    uri: string;
    name: string;
    album: {
      name: string;
      images: Array<{ url: string }>;
    };
    artists: Array<{ name: string }>;
  };

  type SpotifyPlaybackState = {
    paused: boolean;
    position: number;
    duration: number;
    track_window: {
      current_track: SpotifyTrackWindow;
    };
  };

  type SpotifyPlayer = {
    addListener(event: "ready", callback: (payload: { device_id: string }) => void): boolean;
    addListener(event: "not_ready", callback: (payload: { device_id: string }) => void): boolean;
    addListener(event: "player_state_changed", callback: (state: SpotifyPlaybackState | null) => void): boolean;
    addListener(event: "initialization_error" | "authentication_error" | "account_error" | "playback_error", callback: (payload: { message: string }) => void): boolean;
    connect(): Promise<boolean>;
    disconnect(): void;
    getCurrentState(): Promise<SpotifyPlaybackState | null>;
    togglePlay(): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
  };
}
