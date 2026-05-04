export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AudioFeatures = {
  energy: number;
  valence: number;
  tempo: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  speechiness: number;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          spotify_id: string;
          display_name: string | null;
          email: string | null;
          country: string | null;
          onboarded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["users"]["Row"]> & {
          id: string;
          spotify_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
        Relationships: [];
      };
      spotify_accounts: {
        Row: {
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          scopes: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["spotify_accounts"]["Row"]> & {
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["spotify_accounts"]["Row"]>;
        Relationships: [];
      };
      tracks: {
        Row: {
          id: string;
          name: string;
          artist_ids: string[];
          album_id: string | null;
          duration_ms: number;
          explicit: boolean;
          popularity: number;
          spotify_url: string | null;
          audio_features: AudioFeatures | null;
          audio_features_fetched_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tracks"]["Row"]> & {
          id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["tracks"]["Row"]>;
        Relationships: [];
      };
      artists: {
        Row: {
          id: string;
          name: string;
          genres: string[];
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["artists"]["Row"]> & {
          id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["artists"]["Row"]>;
        Relationships: [];
      };
      albums: {
        Row: {
          id: string;
          name: string;
          artist_ids: string[];
          album_type: "album" | "single" | "compilation";
          release_date: string;
          release_date_precision: "year" | "month" | "day";
          image_url: string | null;
          spotify_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["albums"]["Row"]> & {
          id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["albums"]["Row"]>;
        Relationships: [];
      };
      daily_picks: {
        Row: {
          id: string;
          user_id: string;
          pick_date: string;
          track_id: string;
          reason: string;
          score_breakdown: Json;
          dismissed: boolean;
          played: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["daily_picks"]["Row"]> & {
          user_id: string;
          pick_date: string;
          track_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_picks"]["Row"]>;
        Relationships: [];
      };
      captures: {
        Row: {
          id: string;
          user_id: string;
          raw_input: string;
          source: "bookmarklet" | "share" | "paste" | "companion";
          track_id: string | null;
          resolution_state: "pending" | "resolved" | "unresolvable";
          resolution_notes: string | null;
          triaged_at: string | null;
          triage_action: "added-to-playlist" | "saved" | "for-later" | "dismissed" | null;
          triage_target: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["captures"]["Row"]> & {
          user_id: string;
          raw_input: string;
          source: "bookmarklet" | "share" | "paste" | "companion";
        };
        Update: Partial<Database["public"]["Tables"]["captures"]["Row"]>;
        Relationships: [];
      };
      saved_tracks: {
        Row: {
          user_id: string;
          track_id: string;
          saved_at: string;
          last_seen_in_sync_at: string;
          removed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["saved_tracks"]["Row"]> & {
          user_id: string;
          track_id: string;
          saved_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["saved_tracks"]["Row"]>;
        Relationships: [];
      };
      listening_history: {
        Row: {
          user_id: string;
          track_id: string;
          played_at: string;
          context_uri: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["listening_history"]["Row"]> & {
          user_id: string;
          track_id: string;
          played_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["listening_history"]["Row"]>;
        Relationships: [];
      };
      playlists: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          owner_id: string;
          is_owned_by_user: boolean;
          track_count: number;
          snapshot_id: string;
          last_played_at: string | null;
          last_modified_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["playlists"]["Row"]> & {
          id: string;
          user_id: string;
          name: string;
          owner_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["playlists"]["Row"]>;
        Relationships: [];
      };
      playlist_tracks: {
        Row: {
          playlist_id: string;
          track_id: string;
          position: number;
          added_at: string;
          added_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["playlist_tracks"]["Row"]> & {
          playlist_id: string;
          track_id: string;
          position: number;
          added_at: string;
          added_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["playlist_tracks"]["Row"]>;
        Relationships: [];
      };
      playlist_fingerprints: {
        Row: {
          playlist_id: string;
          core_centroid: Json;
          recent_centroid: Json;
          drift_score: number;
          health_label: "healthy" | "drifting" | "stale" | "dying";
          computed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["playlist_fingerprints"]["Row"]> & {
          playlist_id: string;
          core_centroid: Json;
          recent_centroid: Json;
          drift_score: number;
          health_label: "healthy" | "drifting" | "stale" | "dying";
        };
        Update: Partial<Database["public"]["Tables"]["playlist_fingerprints"]["Row"]>;
        Relationships: [];
      };
      watchlist_artists: {
        Row: {
          user_id: string;
          artist_id: string;
          added_at: string;
          include_compilations: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["watchlist_artists"]["Row"]> & {
          user_id: string;
          artist_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["watchlist_artists"]["Row"]>;
        Relationships: [];
      };
      new_releases: {
        Row: {
          id: string;
          user_id: string;
          album_id: string;
          surfaced_at: string;
          dismissed_at: string | null;
          played_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["new_releases"]["Row"]> & {
          user_id: string;
          album_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["new_releases"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
