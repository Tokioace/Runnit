-- Read-only preflight for the staged release candidates, before installation.
-- Run as a trusted database operator. Returns aggregate counts only.
-- A missing prerequisite table/column causes a SQL error: do not proceed.
WITH checks AS (
 SELECT
  (SELECT count(*) FROM public.users u WHERE NOT EXISTS
    (SELECT 1 FROM auth.users a WHERE a.id=u.id)) AS orphan_profiles,
  (SELECT count(*) FROM public.duels WHERE status='matched') AS active_matches,
  (SELECT count(*) FROM (SELECT duel_id,user_id FROM public.duel_results
     GROUP BY duel_id,user_id HAVING count(*)>1) duplicates) AS duplicate_result_groups,
  (SELECT count(*) FROM public.duel_results WHERE duel_id IS NULL OR user_id IS NULL) AS incomplete_result_links,
  (SELECT count(*) FROM public.duel_results r JOIN public.duels d ON d.id=r.duel_id
    WHERE r.user_id IS DISTINCT FROM d.host_user_id AND r.user_id IS DISTINCT FROM d.challenger_user_id) AS nonparticipant_results,
  (SELECT count(*) FROM public.duel_results r WHERE NOT EXISTS
    (SELECT 1 FROM public.duels d WHERE d.id=r.duel_id) OR NOT EXISTS
    (SELECT 1 FROM public.users u WHERE u.id=r.user_id)) AS orphan_results,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN ('users','duels','duel_results','ghost_runs','ghost_run_sessions','runner_stats_preferences')
   AND c.relrowsecurity) AS protected_tables,
  (SELECT count(*) FROM unnest(ARRAY[
    'public.join_duel(uuid)','public.ready_for_duel(uuid)','public.abort_duel(uuid)',
    'public.submit_duel_result(uuid,integer,integer,double precision,double precision,double precision,double precision,jsonb)',
    'public.get_duel_results(uuid)','public.get_top_ghost_runs(text,integer)',
    'public.get_duels_nearby(double precision,double precision,double precision)',
    'public.list_beta_duel_leaderboard(integer,integer)','public.list_beta_runnit_records(text,integer,integer)'
   ]) AS signatures(signature) WHERE to_regprocedure(signature) IS NOT NULL) AS expected_rpcs,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema='auth' AND table_name='sessions'
    AND ((column_name IN ('id','user_id') AND data_type='uuid') OR
         (column_name='not_after' AND data_type='timestamp with time zone'))) AS auth_session_columns,
  (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.duels'::regclass
    AND tgname IN ('guard_duel_cancellation','runnit_duel_lifecycle_guard') AND tgenabled IN ('O','A')
    AND NOT tgisinternal) AS lifecycle_triggers,
  (SELECT count(*) FROM pg_constraint WHERE conrelid='public.users'::regclass
    AND conname='runnit_profile_auth_identity_fk') AS existing_candidate_fk,
  (SELECT count(*) FROM pg_policy WHERE polname='runnit_live_session'
    AND polrelid IN ('public.users'::regclass,'public.duels'::regclass,'public.duel_results'::regclass,
    'public.ghost_runs'::regclass,'public.ghost_run_sessions'::regclass,'public.runner_stats_preferences'::regclass)) AS existing_candidate_policies,
  (to_regclass('public.account_deletion_requests') IS NULL AND
   to_regclass('public.archived_personal_duel_times') IS NULL) AS candidate_tables_absent
)
SELECT *, (orphan_profiles=0 AND active_matches=0 AND duplicate_result_groups=0
 AND incomplete_result_links=0 AND nonparticipant_results=0 AND orphan_results=0
 AND protected_tables=6 AND expected_rpcs=9 AND auth_session_columns=3 AND lifecycle_triggers=2
 AND existing_candidate_fk=0 AND existing_candidate_policies=0 AND candidate_tables_absent) AS preflight_pass
FROM checks;
