-- Run this in the Supabase SQL editor to set up the schema.

-- Users table (extends Supabase auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  letterboxd_username text,
  streaming_subscriptions text[] not null default '{}',
  watchlist_last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);


-- Films table (shared catalog)
create table if not exists public.films (
  id uuid primary key default gen_random_uuid(),
  letterboxd_slug text unique not null,
  title text not null,
  year int,
  tmdb_id int unique,
  poster_url text,
  created_at timestamptz not null default now()
);

alter table public.films enable row level security;

create policy "Films are publicly readable"
  on public.films for select
  using (true);


-- User watchlist
create table if not exists public.user_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  film_id uuid not null references public.films(id) on delete cascade,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  unique(user_id, film_id)
);

alter table public.user_watchlist enable row level security;

create policy "Users can read own watchlist"
  on public.user_watchlist for select
  using (auth.uid() = user_id);

create policy "Users can manage own watchlist"
  on public.user_watchlist for all
  using (auth.uid() = user_id);


-- Streaming availability
create table if not exists public.streaming_availability (
  id uuid primary key default gen_random_uuid(),
  film_id uuid not null references public.films(id) on delete cascade,
  provider_id int not null,
  provider_name text not null,
  provider_logo_path text,
  region text not null default 'US',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(film_id, provider_id, region)
);

alter table public.streaming_availability enable row level security;

create policy "Streaming availability is publicly readable"
  on public.streaming_availability for select
  using (true);


-- Indexes for performance
create index if not exists idx_user_watchlist_user_id on public.user_watchlist(user_id);
create index if not exists idx_user_watchlist_film_id on public.user_watchlist(film_id);
create index if not exists idx_streaming_film_id on public.streaming_availability(film_id);
create index if not exists idx_streaming_last_seen on public.streaming_availability(last_seen_at);
create index if not exists idx_films_slug on public.films(letterboxd_slug);
create index if not exists idx_films_tmdb_id on public.films(tmdb_id);
