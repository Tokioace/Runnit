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

-- Add challenger column if missing
alter table public.duels
  add column if not exists challenger_user_id uuid references public.users(id) on delete set null;

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
-- Allow authenticated users to read ghost runs for leaderboard
create policy "Ghost runs readable by authenticated" on public.ghost_runs for select using (auth.role() = 'authenticated');

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

-- Public leaderboard RPC: returns top ghost runs with username and user coords for a city
create or replace function public.get_top_ghost_runs(
  city_name text,
  limit_count integer default 100
)
returns table (
  id uuid,
  user_id uuid,
  username text,
  time_ms integer,
  user_lat double precision,
  user_lng double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select gr.id,
         gr.user_id,
         coalesce(u.username, 'runner') as username,
         gr.time_ms,
         case when u.location is not null then ST_Y(u.location::geometry) else null end as user_lat,
         case when u.location is not null then ST_X(u.location::geometry) else null end as user_lng
  from public.ghost_runs gr
  left join public.users u on u.id = gr.user_id
  where gr.city = city_name
  order by gr.time_ms asc nulls last
  limit greatest(1, least(limit_count, 1000));
$$;
-- Function: join_duel - allow an authenticated user to join an open duel
create or replace function public.join_duel(
  duel_id uuid
)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel public.duels;
begin
  -- Lock the row to avoid race conditions
  select * into v_duel from public.duels where id = join_duel.duel_id for update;
  if not found then
    raise exception 'Duel not found';
  end if;
  if v_duel.status <> 'open' then
    raise exception 'Duel is not open';
  end if;
  if v_duel.host_user_id = auth.uid() then
    raise exception 'Host cannot join own duel';
  end if;

  update public.duels
    set challenger_user_id = auth.uid(),
        status = 'matched'
    where id = join_duel.duel_id
      and status = 'open'
      and (challenger_user_id is null or challenger_user_id = auth.uid())
    returning * into v_duel;

  return v_duel;
end;
$$;

