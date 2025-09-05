-- Enable extensions
create extension if not exists postgis;

-- Tables
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text,
  city text,
  country text,
  location geography(point),
  joined_at timestamptz default now()
);

create table if not exists public.ghost_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  city text,
  time_ms integer,
  created_at timestamptz default now()
);

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid references public.users(id) on delete cascade,
  location geography(point),
  max_distance_km integer,
  status text default 'open',
  created_at timestamptz default now()
);

-- RLS
alter table public.users enable row level security;
alter table public.ghost_runs enable row level security;
alter table public.duels enable row level security;

-- Policies
-- Users can view themselves
drop policy if exists "Users can view themselves" on public.users;
create policy "Users can view themselves" on public.users for select using (auth.uid() = id);

-- Ghost runs: a user can see only their own
drop policy if exists "Own ghost runs select" on public.ghost_runs;
create policy "Own ghost runs select" on public.ghost_runs for select using (auth.uid() = user_id);

-- Ghost runs: owners can insert
drop policy if exists "Insert own ghost runs" on public.ghost_runs;
create policy "Insert own ghost runs" on public.ghost_runs for insert with check (auth.uid() = user_id);

-- Duels: authenticated users can read public open duels
drop policy if exists "Read open duels" on public.duels;
create policy "Read open duels" on public.duels for select using (auth.role() = 'authenticated');

-- Duels: only logged-in user can insert/update their duels
drop policy if exists "Insert own duels" on public.duels;
create policy "Insert own duels" on public.duels for insert with check (auth.uid() = host_user_id);

drop policy if exists "Update own duels" on public.duels;
create policy "Update own duels" on public.duels for update using (auth.uid() = host_user_id);

-- Function: get_duels_nearby
create or replace function public.get_duels_nearby(
  lat double precision,
  lng double precision,
  radius_km double precision
)
returns setof public.duels
language sql
stable
as $$
  select *
  from public.duels
  where status = 'open'
    and ST_DWithin(location, ST_MakePoint(lng, lat)::geography, radius_km * 1000)
  order by created_at desc
$$;

