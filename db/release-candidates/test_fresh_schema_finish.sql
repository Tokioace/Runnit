-- Disposable CI ONLY. Run after test_fresh_schema.sql rolled back its data.
-- Separate autocommit statements intentionally model separate API requests:
-- result created_at defaults to transaction time, not a backdated test clock.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database() <> 'runnit_schema_test' OR current_user <> 'postgres'
 OR NOT public.runnit_test_erasure_gate()
 OR EXISTS(SELECT 1 FROM auth.users) OR EXISTS(SELECT 1 FROM auth.sessions)
 OR EXISTS(SELECT 1 FROM public.users) OR EXISTS(SELECT 1 FROM public.duels)
 OR EXISTS(SELECT 1 FROM public.duel_results)
 OR EXISTS(SELECT 1 FROM public.archived_personal_duel_times) THEN
   RAISE EXCEPTION 'Fresh disposable schema rehearsal required';
 END IF;
END
$guard$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000011','alpha@example.invalid','{"display_name":"Alpha"}'),
 ('00000000-0000-4000-8000-000000000012','beta@example.invalid','{"display_name":"Beta"}'),
 ('00000000-0000-4000-8000-000000000013','third@example.invalid','{"display_name":"Third"}');
INSERT INTO auth.sessions VALUES
 ('10000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000011',NULL),
 ('10000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000012',NULL),
 ('10000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000013',NULL);
SET ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000011',false);
SELECT set_config('test.session','10000000-0000-4000-8000-000000000011',false);
UPDATE public.users SET leaderboard_opt_in=true WHERE id=auth.uid();
INSERT INTO public.runner_stats_preferences(user_id,weekly_distance_goal_m) VALUES(auth.uid(),3000);
INSERT INTO public.account_deletion_requests(user_id) VALUES(auth.uid());
INSERT INTO public.ghost_runs(user_id,city,time_ms) VALUES(auth.uid(),'Fixture',6500);
INSERT INTO public.ghost_run_sessions(user_id,target_distance_m,run_state,elapsed_ms,observed_distance_m,steps_count,
 gps_accepted,gps_rejected,motion_samples,motion_gaps,motion_permission)
 VALUES(auth.uid(),50,'finished',6500,50,27,8,0,300,0,'granted');
INSERT INTO public.duels(host_user_id,location,max_distance_km,target_distance_m,status)
 VALUES(auth.uid(),ST_GeogFromText('SRID=4326;POINT(0 0)'),1,50,'open') RETURNING id AS race \gset
SELECT set_config('test.race',:'race',false);
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000012',false);
SELECT set_config('test.session','10000000-0000-4000-8000-000000000012',false);
SELECT public.join_duel(:'race');
SELECT public.ready_for_duel(:'race');
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000011',false);
SELECT set_config('test.session','10000000-0000-4000-8000-000000000011',false);
SELECT public.ready_for_duel(:'race');
RESET ROLE;
-- The actual shared-race deletion trigger must reject an active race
-- without dropping the user's profile, session or pending request.
DO $active$
BEGIN
 BEGIN
   DELETE FROM auth.users WHERE id='00000000-0000-4000-8000-000000000011';
   RAISE EXCEPTION 'Active race allowed account erasure';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id='00000000-0000-4000-8000-000000000011')
 OR NOT EXISTS(SELECT 1 FROM auth.sessions WHERE user_id='00000000-0000-4000-8000-000000000011')
 OR NOT EXISTS(SELECT 1 FROM public.account_deletion_requests WHERE user_id='00000000-0000-4000-8000-000000000011')
 OR NOT EXISTS(SELECT 1 FROM public.duels WHERE id=current_setting('test.race')::uuid AND status='matched')
 OR EXISTS(SELECT 1 FROM public.archived_personal_duel_times) THEN
  RAISE EXCEPTION 'Blocked erasure changed data';
 END IF;
END
$active$;
-- Wait for real countdown + plausible time; no privileged clock editing.
SELECT pg_sleep(GREATEST(0, EXTRACT(epoch FROM
 ((SELECT start_at FROM public.duels WHERE id=:'race') + interval '7 seconds' - clock_timestamp()))));
SET ROLE authenticated;
SELECT public.submit_duel_result(:'race',5500,25,2,10,5,50,
 '{"motionCoverage":0.9,"verification":"verified","rawLocation":[0,0]}');
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000012',false);
SELECT set_config('test.session','10000000-0000-4000-8000-000000000012',false);
SELECT public.submit_duel_result(:'race',6000,28,1.8,9,4,50,'{"motionCoverage":0.8}');
DO $opponent$
DECLARE race uuid:=current_setting('test.race')::uuid;
BEGIN
 IF (SELECT count(*) FROM public.get_duel_results(race))<>2
 OR EXISTS(SELECT 1 FROM public.get_duel_results(race) WHERE user_id<>auth.uid() AND metrics_json IS NOT NULL)
 OR (SELECT metrics_json->>'verification' FROM public.get_duel_results(race) WHERE user_id=auth.uid()) IS DISTINCT FROM 'unverified'
 OR (SELECT count(*) FROM public.duel_results WHERE duel_id=race)<>1 THEN
  RAISE EXCEPTION 'Participant result visibility mismatch';
 END IF;
 IF (public.submit_duel_result(race,7000)).time_ms IS DISTINCT FROM 6000 THEN
  RAISE EXCEPTION 'Retry overwrote first finish';
 END IF;
END
$opponent$;
RESET ROLE;
DO $finished$
DECLARE race uuid:=current_setting('test.race')::uuid;
BEGIN
 IF (SELECT status FROM public.duels WHERE id=race) IS DISTINCT FROM 'completed'
 OR (SELECT count(*) FROM public.duel_results WHERE duel_id=race)<>2
 OR EXISTS(SELECT 1 FROM public.duel_results WHERE duel_id=race AND metrics_json ? 'rawLocation')
 OR EXISTS(SELECT 1 FROM public.duel_results WHERE duel_id=race AND metrics_json->>'verification' IS DISTINCT FROM 'unverified') THEN
  RAISE EXCEPTION 'Combined finish or diagnostic validation failed';
 END IF;
END
$finished$;
SET ROLE anon;
DO $optin$
BEGIN
 IF (SELECT count(*) FROM public.list_beta_duel_leaderboard(50,100))<>1
 OR NOT EXISTS(SELECT 1 FROM public.list_beta_duel_leaderboard(50,100) WHERE username='Alpha' AND best_time_ms=5500)
 OR (SELECT count(*) FROM public.list_beta_runnit_records('times',50,10))<>1 THEN
  RAISE EXCEPTION 'Public opt-in ranking failed';
 END IF;
END
$optin$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000013',false);
SELECT set_config('test.session','10000000-0000-4000-8000-000000000013',false);
DO $outsider$
BEGIN
 IF EXISTS(SELECT 1 FROM public.get_duel_results(current_setting('test.race')::uuid))
 OR EXISTS(SELECT 1 FROM public.duel_results)
 OR EXISTS(SELECT 1 FROM public.ghost_run_sessions)
 OR EXISTS(SELECT 1 FROM public.account_deletion_requests) THEN
  RAISE EXCEPTION 'Outsider saw private records';
 END IF;
END
$outsider$;
RESET ROLE;
-- Simulate only the database cascade of the Auth admin delete. This is not
-- an actual GoTrue request. All identities are synthetic, in the CI container.
DELETE FROM auth.users WHERE id='00000000-0000-4000-8000-000000000011';
DO $erase$
DECLARE actor uuid:='00000000-0000-4000-8000-000000000011';
BEGIN
 IF EXISTS(SELECT 1 FROM auth.users WHERE id=actor)
 OR EXISTS(SELECT 1 FROM auth.sessions WHERE user_id=actor)
 OR EXISTS(SELECT 1 FROM public.users WHERE id=actor)
 OR EXISTS(SELECT 1 FROM public.ghost_runs WHERE user_id=actor)
 OR EXISTS(SELECT 1 FROM public.ghost_run_sessions WHERE user_id=actor)
 OR EXISTS(SELECT 1 FROM public.runner_stats_preferences WHERE user_id=actor)
 OR EXISTS(SELECT 1 FROM public.account_deletion_requests WHERE user_id=actor)
 OR EXISTS(SELECT 1 FROM public.duels)
 OR EXISTS(SELECT 1 FROM public.duel_results)
 OR (SELECT count(*) FROM public.archived_personal_duel_times)<>1
 OR NOT EXISTS(SELECT 1 FROM public.archived_personal_duel_times WHERE
 user_id='00000000-0000-4000-8000-000000000012' AND time_ms=6000 AND target_distance_m=50) THEN
  RAISE EXCEPTION 'Combined erasure or private archive failed';
 END IF;
END
$erase$;
SET ROLE authenticated;
DO $archive_outsider$
BEGIN
 IF EXISTS(SELECT 1 FROM public.archived_personal_duel_times) THEN
  RAISE EXCEPTION 'Outsider saw archive';
 END IF;
END
$archive_outsider$;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000012',false);
SELECT set_config('test.session','10000000-0000-4000-8000-000000000012',false);
DO $archive_owner$
BEGIN
 IF (SELECT count(*) FROM public.archived_personal_duel_times WHERE time_ms=6000)<>1 THEN
  RAISE EXCEPTION 'Survivor cannot read own private result';
 END IF;
END
$archive_owner$;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000011',false);
SELECT set_config('test.session','10000000-0000-4000-8000-000000000011',false);
DO $deleted$
BEGIN
 IF EXISTS(SELECT 1 FROM public.users) OR EXISTS(SELECT 1 FROM public.archived_personal_duel_times) THEN
  RAISE EXCEPTION 'Deleted session still reads protected tables';
 END IF;
 BEGIN
   INSERT INTO public.users(id,username) VALUES(auth.uid(),'Stale');
   RAISE EXCEPTION 'Deleted session recreated profile';
 EXCEPTION WHEN insufficient_privilege OR foreign_key_violation THEN NULL;
 END;
END
$deleted$;
RESET ROLE;
SET ROLE anon;
DO $no_rank$
BEGIN
 IF EXISTS(SELECT 1 FROM public.list_beta_duel_leaderboard(50,100))
 OR EXISTS(SELECT 1 FROM public.list_beta_runnit_records('times',50,10)) THEN
  RAISE EXCEPTION 'Archived result still public';
 END IF;
END
$no_rank$;
RESET ROLE;
\echo Combined completed race, privacy and erasure passed
