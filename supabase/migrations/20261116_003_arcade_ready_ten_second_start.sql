-- Runnit 1v1: server-authoritative ten-second countdown following BOTH READY.
-- Review before applying to Supabase; does not create, cancel or modify races.
-- Prevent anonymous calls and client-side writes to ready flags or start_at.
begin;

create or replace function public.ready_for_duel(p_duel_id uuid)
returns public.duels
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $fn$
declare
  v_duel public.duels;
  v_actor uuid := auth.uid();
  v_is_host boolean;
begin
  if v_actor is null then
    raise exception 'Login required' using errcode = '42501';
  end if;
  select * into v_duel
    from public.duels
    where id = p_duel_id
    for update;
  if not found then
    raise exception 'Duel not found' using errcode = 'P0002';
  end if;
  if v_duel.status is distinct from 'matched' or v_duel.challenger_user_id is null then
    raise exception 'Duel not matched' using errcode = '23514';
  end if;
  if v_actor is distinct from v_duel.host_user_id
     and v_actor is distinct from v_duel.challenger_user_id then
    raise exception 'Not a participant' using errcode = '42501';
  end if;
  -- Ready and the chosen start time are immutable once scheduled.
  if v_duel.start_at is not null then return v_duel; end if;
  v_is_host := v_actor = v_duel.host_user_id;

  update public.duels
     set host_ready = case when v_is_host then true else host_ready end,
         challenger_ready = case when not v_is_host then true else challenger_ready end,
         start_at = case
           when (v_is_host or host_ready) and (not v_is_host or challenger_ready)
             then statement_timestamp() + interval '10 seconds'
           else start_at
         end
   where id = p_duel_id and status = 'matched'
   returning * into v_duel;

  if not found then
    raise exception 'Duel unavailable' using errcode = '23514';
  end if;
  return v_duel;
end;
$fn$;

revoke all on function public.ready_for_duel(uuid) from public, anon;
grant execute on function public.ready_for_duel(uuid) to authenticated;

-- Other app updates only need status='cancelled' by the original host.
-- SECURITY DEFINER ready_for_duel and submit_duel_result retain server-side
-- write privileges. Client must not forge readiness/start times.
revoke update on table public.duels from authenticated;
grant update(status) on table public.duels to authenticated;

commit;
