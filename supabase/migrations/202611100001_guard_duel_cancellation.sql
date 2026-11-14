-- Apply only after review in a controlled Supabase migration.
-- Reject forged cancellations, including attempts to change other columns in the same UPDATE.
create or replace function public.guard_duel_cancellation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if auth.uid() is null
       or old.host_user_id is distinct from auth.uid()
       or old.status is distinct from 'open'
       or old.challenger_user_id is not null
       or (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status')
    then
      raise exception 'Cancellation not permitted' using errcode = '42501';
    end if;
  end if;
  if old.status = 'cancelled' and new is distinct from old then
    raise exception 'Cancelled duel is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_duel_cancellation on public.duels;
create trigger guard_duel_cancellation before update on public.duels
for each row execute function public.guard_duel_cancellation();

-- Narrow the existing host UPDATE policy to authenticated owners.
drop policy if exists "Update own duels" on public.duels;
create policy "Update own duels" on public.duels for update to authenticated
using ((select auth.uid()) = host_user_id)
with check ((select auth.uid()) = host_user_id);
