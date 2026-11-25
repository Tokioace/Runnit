#!/usr/bin/env bash
set -euo pipefail
db="${1:?disposable container required}"
sql() { docker exec -i "$db" psql -X -U postgres -d runnit_test -v ON_ERROR_STOP=1 "$@"; }
# A single ephemeral service is used; previous fixture rolled back.
sql -f /tmp/duel_integration_setup.sql
id="$(sql -Atc "SELECT id FROM public.duels WHERE status='matched'")"
[[ "$id" =~ ^[0-9a-f-]{36}$ ]]
# Both device requests use separate committed sessions. Wait for real start.
sql -c "SELECT pg_sleep(GREATEST(0, EXTRACT(epoch FROM ((SELECT start_at FROM public.duels WHERE id='$id') + interval '7 seconds' - clock_timestamp()))))"
submit() {
  local actor="$1" elapsed="$2"
  sql -c "SET ROLE authenticated; SELECT set_config('test.actor','$actor',false); SELECT (public.submit_duel_result('$id',$elapsed)).time_ms;"
}
submit 00000000-0000-4000-8000-000000000011 5500 & p1=$!
submit 00000000-0000-4000-8000-000000000012 6000 & p2=$!
wait "$p1"
wait "$p2"
sql -c "DO \$check\$ BEGIN IF (SELECT status FROM public.duels WHERE id='$id') IS DISTINCT FROM 'completed' OR (SELECT count(*) FROM public.duel_results WHERE duel_id='$id') <> 2 THEN RAISE EXCEPTION 'concurrent finish not atomic'; END IF; END \$check\$;"
submit 00000000-0000-4000-8000-000000000011 7000
sql -c "DO \$check\$ BEGIN IF (SELECT time_ms FROM public.duel_results WHERE duel_id='$id' AND user_id='00000000-0000-4000-8000-000000000011') IS DISTINCT FROM 5500 THEN RAISE EXCEPTION 'retry changed result'; END IF; END \$check\$;"
sql -c "SET ROLE anon; DO \$check\$ BEGIN IF (SELECT count(*) FROM public.list_beta_duel_leaderboard(50,100)) <> 2 THEN RAISE EXCEPTION 'completed pair missing from beta ranking'; END IF; END \$check\$;"
# Abort a second matched event and verify the host slot is released again.
sql <<'SQL'
SET ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000011',false);
INSERT INTO public.duels(host_user_id,location,max_distance_km,target_distance_m,status)
 VALUES (auth.uid(),'fixture',1,75,'open') RETURNING id AS second_id \gset
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000012',false);
SELECT public.join_duel(:'second_id');
SELECT public.abort_duel(:'second_id');
RESET ROLE;
DO $check$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.duels WHERE status='abandoned' AND target_distance_m=75) THEN
   RAISE EXCEPTION 'abort did not persist';
 END IF;
END
$check$;
SET ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000011',false);
INSERT INTO public.duels(host_user_id,location,max_distance_km,target_distance_m,status)
 VALUES (auth.uid(),'fixture',1,100,'open');
SQL
