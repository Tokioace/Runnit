-- Personal Stats weekly distance goal, distinct from race facts.
-- Race/ghost measurements remain stored in their existing authoritative tables.
create table if not exists public.runner_stats_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly_distance_goal_m integer not null default 1000
    check (weekly_distance_goal_m in (1000,3000,5000,10000)),
  updated_at timestamptz not null default now()
);

alter table public.runner_stats_preferences enable row level security;
revoke all on public.runner_stats_preferences from public, anon;
grant select, insert, update on public.runner_stats_preferences to authenticated;

create policy "read own stats preferences"
  on public.runner_stats_preferences
  for select to authenticated
  using (user_id=(select auth.uid()));

create policy "insert own stats preferences"
  on public.runner_stats_preferences
  for insert to authenticated
  with check (user_id=(select auth.uid()));

create policy "update own stats preferences"
  on public.runner_stats_preferences
  for update to authenticated
  using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));

comment on table public.runner_stats_preferences is
  'Per-user goals for STATS display. Duels and trainings remain saved separately.';
