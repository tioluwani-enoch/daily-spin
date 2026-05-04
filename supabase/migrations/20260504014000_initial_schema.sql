create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.users (
  id uuid primary key,
  spotify_id text not null unique,
  display_name text,
  email text,
  country text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.spotify_accounts (
  user_id uuid primary key references public.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.artists (
  id text primary key,
  name text not null,
  genres text[] not null default '{}',
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.albums (
  id text primary key,
  name text not null,
  artist_ids text[] not null default '{}',
  album_type text not null check (album_type in ('album', 'single', 'compilation')),
  release_date date not null,
  release_date_precision text not null check (release_date_precision in ('year', 'month', 'day')),
  image_url text,
  spotify_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tracks (
  id text primary key,
  name text not null,
  artist_ids text[] not null default '{}',
  album_id text references public.albums(id) on delete set null,
  duration_ms int not null default 0,
  explicit boolean not null default false,
  popularity int not null default 0 check (popularity between 0 and 100),
  spotify_url text,
  audio_features jsonb,
  audio_features_fetched_at timestamptz,
  unavailable_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_tracks (
  user_id uuid not null references public.users(id) on delete cascade,
  track_id text not null references public.tracks(id) on delete cascade,
  saved_at timestamptz not null,
  last_seen_in_sync_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

create table public.listening_history (
  user_id uuid not null references public.users(id) on delete cascade,
  track_id text not null references public.tracks(id) on delete cascade,
  played_at timestamptz not null,
  context_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, track_id, played_at)
);

create table public.watchlist_artists (
  user_id uuid not null references public.users(id) on delete cascade,
  artist_id text not null references public.artists(id) on delete cascade,
  added_at timestamptz not null default now(),
  include_compilations boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create table public.new_releases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  album_id text not null references public.albums(id) on delete cascade,
  surfaced_at timestamptz not null default now(),
  dismissed_at timestamptz,
  played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, album_id)
);

create table public.captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  raw_input text not null,
  source text not null check (source in ('bookmarklet', 'share', 'paste', 'companion')),
  track_id text references public.tracks(id) on delete set null,
  resolution_state text not null default 'pending' check (resolution_state in ('pending', 'resolved', 'unresolvable')),
  resolution_notes text,
  triaged_at timestamptz,
  triage_action text check (triage_action in ('added-to-playlist', 'saved', 'for-later', 'dismissed')),
  triage_target text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.playlists (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  owner_id text not null,
  is_owned_by_user boolean not null default false,
  track_count int not null default 0,
  snapshot_id text not null default '',
  last_played_at timestamptz,
  last_modified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.playlist_tracks (
  playlist_id text not null references public.playlists(id) on delete cascade,
  track_id text not null references public.tracks(id) on delete cascade,
  position int not null,
  added_at timestamptz not null,
  added_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (playlist_id, track_id, position)
);

create table public.playlist_fingerprints (
  playlist_id text primary key references public.playlists(id) on delete cascade,
  core_centroid jsonb not null,
  recent_centroid jsonb not null,
  drift_score real not null,
  health_label text not null check (health_label in ('healthy', 'drifting', 'stale', 'dying')),
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pick_date date not null,
  track_id text not null references public.tracks(id) on delete cascade,
  reason text not null,
  score_breakdown jsonb not null default '{}',
  dismissed boolean not null default false,
  played boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pick_date, track_id)
);

create table public.weekly_recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  week_start date not null,
  data jsonb not null default '{}',
  prose text not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.companion_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'tool_result')),
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_tracks_user_saved_at_idx on public.saved_tracks (user_id, saved_at desc);
create index listening_history_user_played_at_idx on public.listening_history (user_id, played_at desc);
create index playlist_tracks_playlist_position_idx on public.playlist_tracks (playlist_id, position);
create index new_releases_open_idx on public.new_releases (user_id, surfaced_at desc) where dismissed_at is null;
create index companion_messages_conversation_idx on public.companion_messages (user_id, conversation_id, created_at);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'spotify_accounts', 'artists', 'albums', 'tracks', 'saved_tracks',
    'listening_history', 'watchlist_artists', 'new_releases', 'captures',
    'playlists', 'playlist_tracks', 'playlist_fingerprints', 'daily_picks',
    'weekly_recaps', 'companion_messages'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

create policy "users can read self" on public.users for select using (auth.uid() = id);
create policy "users can update self" on public.users for update using (auth.uid() = id);

create policy "spotify accounts are private" on public.spotify_accounts for all using (auth.uid() = user_id);
create policy "saved tracks are private" on public.saved_tracks for all using (auth.uid() = user_id);
create policy "history is private" on public.listening_history for all using (auth.uid() = user_id);
create policy "watchlist is private" on public.watchlist_artists for all using (auth.uid() = user_id);
create policy "new releases are private" on public.new_releases for all using (auth.uid() = user_id);
create policy "captures are private" on public.captures for all using (auth.uid() = user_id);
create policy "playlists are private" on public.playlists for all using (auth.uid() = user_id);
create policy "recaps are private" on public.weekly_recaps for all using (auth.uid() = user_id);
create policy "companion messages are private" on public.companion_messages for all using (auth.uid() = user_id);

create policy "shared artist metadata is readable" on public.artists for select using (true);
create policy "shared album metadata is readable" on public.albums for select using (true);
create policy "shared track metadata is readable" on public.tracks for select using (true);

create policy "playlist tracks readable through owned playlist" on public.playlist_tracks
for select using (
  exists (
    select 1 from public.playlists
    where playlists.id = playlist_tracks.playlist_id
      and playlists.user_id = auth.uid()
  )
);

create policy "playlist fingerprints readable through owned playlist" on public.playlist_fingerprints
for select using (
  exists (
    select 1 from public.playlists
    where playlists.id = playlist_fingerprints.playlist_id
      and playlists.user_id = auth.uid()
  )
);
