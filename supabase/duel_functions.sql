-- Ready for duel: mark participant ready and schedule start_at when both ready
create or replace function public.ready_for_duel(
  p_duel_id uuid
)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel public.duels;
  v_is_host boolean;
begin
  select * into v_duel from public.duels where id = p_duel_id for update;
  if not found then
    raise exception 'Duel not found';
  end if;
  if v_duel.status <> 'matched' then
    raise exception 'Duel not matched';
  end if;
  v_is_host := (v_duel.host_user_id = auth.uid());
  if not v_is_host and v_duel.challenger_user_id <> auth.uid() then
    raise exception 'Not a participant';
  end if;

  update public.duels
    set host_ready = case when v_is_host then true else host_ready end,
        challenger_ready = case when not v_is_host then true else challenger_ready end,
        start_at = case when ( (case when v_is_host then true else host_ready end)
                          and (case when not v_is_host then true else challenger_ready end)
                          and start_at is null ) then now() + interval '3 seconds' else start_at end
    where id = p_duel_id
    returning * into v_duel;

  return v_duel;
end;
$$;

-- Get duel results with usernames for side-by-side view
create or replace function public.get_duel_results(
  p_duel_id uuid
)
returns table (
  user_id uuid,
  username text,
  time_ms integer,
  steps_count integer,
  step_length_m_avg double precision,
  max_speed_mps double precision,
  max_accel_mps2 double precision,
  distance_m double precision,
  metrics_json jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.user_id,
         coalesce(u.username, 'runner') as username,
         r.time_ms,
         r.steps_count,
         r.step_length_m_avg,
         r.max_speed_mps,
         r.max_accel_mps2,
         r.distance_m,
         r.metrics_json,
         r.created_at
  from public.duel_results r
  left join public.users u on u.id = r.user_id
  where r.duel_id = p_duel_id
  order by r.created_at asc
$$;
