-- CI only: no production connection, no remote credentials, no real users.
-- Replays checked-in base schema + historical SQL + candidates together.
-- Supabase Auth functions/roles are modeled, NOT actual GoTrue or PostgREST.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database() <> 'runnit_schema_test' OR current_user <> 'postgres'
 OR to_regclass('auth.users') IS NOT NULL OR to_regclass('public.users') IS NOT NULL THEN
  RAISE EXCEPTION 'Fresh isolated database required';
 END IF;
END
$guard$;
-- Historical migrations may manage their own transactions. Replay them as-is.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,not_after timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
 SELECT NULLIF(current_setting('test.actor',true),'')::uuid
$fn$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $fn$
 SELECT current_user::text
$fn$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $fn$
 SELECT jsonb_build_object('session_id',current_setting('test.session',true))
$fn$;
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
CREATE PUBLICATION supabase_realtime;
\ir ../../supabase/schema.sql
\ir ../../supabase/duel_functions.sql
-- Explicit simulation of legacy app table grants, not a claim about a
-- particular hosted project's default ACL configuration.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users,public.ghost_runs,public.duels,public.duel_results TO authenticated,anon;
\ir ../../supabase/migrations/20261109_001_auth_privacy_hardening.sql
\ir ../../supabase/migrations/20261109_002_restrict_auth_trigger_rpc.sql
\ir ../../supabase/migrations/202611100001_guard_duel_cancellation.sql
\ir ../one_active_event_60min_lifecycle.sql
\ir ../../supabase/migrations/20261116_003_arcade_ready_ten_second_start.sql
\ir ../../supabase/migrations/20261116_004_abort_matched_duel.sql
\ir ../../supabase/migrations/20261116_005_complete_duel_for_both_players.sql
\ir ../../supabase/migrations/20261117_001_private_ghost_run_sessions.sql
\ir ../../supabase/migrations/20261118080546_runnit_revoke_unnecessary_truncate_grants_20261118.sql
\ir ../../supabase/migrations/20261118081519_runnit_revoke_app_dangerous_grants_and_postgres_defaults_20261118.sql
\ir ../../supabase/migrations/20261118091810_real_beta_duel_leaderboards_20261118.sql
\ir ../../supabase/migrations/20261118092355_real_beta_duel_leaderboards_20261118.sql
\ir ../../supabase/migrations/20261118092642_runnit_public_opt_in_beta_ranking_20261118.sql
\ir ../../supabase/migrations/20261118094751_sync_public_display_names_20261118.sql
\ir ../../supabase/migrations/20261118101752_beta_record_categories_20261118.sql
\ir ../../supabase/migrations/20261119_001_runner_stats_preferences.sql
-- Execute the identical read-only operator preflight before candidate DDL.
\ir release_preflight.sql
\gset baseline_
\if :baseline_preflight_pass
\else
  \echo Baseline preflight failed
  SELECT 1/0;
\endif
-- Negative control: a synthetic orphan must prevent release.
BEGIN;
INSERT INTO public.users(id,username) VALUES('90000000-0000-4000-8000-000000000001','Synthetic orphan');
\ir release_preflight.sql
\gset negative_
\if :negative_preflight_pass
  \echo Orphan unexpectedly passed preflight
  SELECT 1/0;
\endif
ROLLBACK;
\ir duel_result_guard.sql
\ir beta_ranking_guard.sql
\ir account_deletion_requests.sql
\ir account_erasure_guard.sql
\ir shared_duel_erasure.sql
\ir session_access_guard.sql
\ir test_only_erasure_gate.sql
-- Start a separate transaction AFTER migration replay so SET LOCAL and
-- transaction-local synthetic JWT claims remain active until ROLLBACK.
BEGIN;
DO $catalog$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['users','duels','duel_results','ghost_runs','ghost_run_sessions',
  'runner_stats_preferences','account_deletion_requests','archived_personal_duel_times'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=to_regclass('public.'||tab) AND c.relrowsecurity)
     OR NOT EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=to_regclass('public.'||tab)
       AND p.polname='runnit_live_session' AND NOT p.polpermissive)
     OR has_table_privilege('anon','public.'||tab,'SELECT,INSERT,UPDATE,DELETE')
     OR has_any_column_privilege('anon','public.'||tab,'SELECT,INSERT,UPDATE') THEN
    RAISE EXCEPTION 'Protected table or grants mismatch: %',tab;
  END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
   AND schemaname='public' AND tablename='duels') THEN RAISE EXCEPTION 'Realtime table missing'; END IF;
 IF NOT public.runnit_test_erasure_gate() THEN RAISE EXCEPTION 'Erasure gate missing'; END IF;
 IF has_function_privilege('anon','public.join_duel(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.submit_duel_result(uuid,integer,integer,double precision,double precision,double precision,double precision,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.runnit_test_erasure_gate()','EXECUTE')
 OR has_column_privilege('authenticated','public.users','location','SELECT')
 OR has_column_privilege('authenticated','public.duels','start_at','INSERT')
 OR has_table_privilege('authenticated','public.duel_results','INSERT,UPDATE,DELETE') THEN
   RAISE EXCEPTION 'Unexpected application privilege';
 END IF;
END
$catalog$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('00000000-0000-4000-8000-000000000011','alpha@example.invalid','{"display_name":"Alpha"}'),
 ('00000000-0000-4000-8000-000000000012','beta@example.invalid','{"display_name":"Beta"}'),
 ('00000000-0000-4000-8000-000000000013','third@example.invalid','{}');
INSERT INTO auth.sessions VALUES
 ('10000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000011',NULL),
 ('10000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000012',NULL),
 ('10000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000013',NULL);
DO $profile$
BEGIN
 IF (SELECT count(*) FROM public.users)<>3 OR
    NOT EXISTS(SELECT 1 FROM public.users WHERE username='Runnit-Läufer') OR
    EXISTS(SELECT 1 FROM public.users WHERE leaderboard_opt_in) THEN
  RAISE EXCEPTION 'Fresh profile trigger or privacy default failed';
 END IF;
END
$profile$;
SET LOCAL ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000011',true);
SELECT set_config('test.session','10000000-0000-4000-8000-000000000011',true);
INSERT INTO public.duels(host_user_id,location,max_distance_km,target_distance_m,status)
 VALUES(auth.uid(),ST_GeogFromText('SRID=4326;POINT(0 0)'),1,50,'open') RETURNING id AS duel_id \gset
SELECT set_config('test.duel',:'duel_id',true);
DO $nearby$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.get_duels_nearby(0,0,1) WHERE id=current_setting('test.duel')::uuid) THEN
  RAISE EXCEPTION 'PostGIS nearby lookup failed';
 END IF;
END
$nearby$;
INSERT INTO public.runner_stats_preferences(user_id,weekly_distance_goal_m) VALUES(auth.uid(),3000);
INSERT INTO public.account_deletion_requests(user_id) VALUES(auth.uid());
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000012',true);
SELECT set_config('test.session','10000000-0000-4000-8000-000000000012',true);
DO $privacy$
BEGIN
 IF EXISTS(SELECT 1 FROM public.runner_stats_preferences) OR EXISTS(SELECT 1 FROM public.account_deletion_requests) THEN
  RAISE EXCEPTION 'Cross-account private data exposed';
 END IF;
END
$privacy$;
SELECT public.join_duel(:'duel_id');
SELECT public.ready_for_duel(:'duel_id');
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000011',true);
SELECT set_config('test.session','10000000-0000-4000-8000-000000000011',true);
SELECT public.ready_for_duel(:'duel_id');
DO $ready$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.duels WHERE id=current_setting('test.duel')::uuid
   AND host_ready AND challenger_ready AND start_at>statement_timestamp()) THEN
  RAISE EXCEPTION 'Combined readiness failed';
 END IF;
 BEGIN
  PERFORM public.submit_duel_result(current_setting('test.duel')::uuid,6000);
  RAISE EXCEPTION 'Premature result accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END
$ready$;
SELECT public.abort_duel(:'duel_id');
RESET ROLE;
DELETE FROM auth.sessions WHERE id='10000000-0000-4000-8000-000000000011';
SET LOCAL ROLE authenticated;
DO $stale$
BEGIN
 IF EXISTS(SELECT 1 FROM public.users) OR EXISTS(SELECT 1 FROM public.duels)
   OR EXISTS(SELECT 1 FROM public.runner_stats_preferences) OR EXISTS(SELECT 1 FROM public.account_deletion_requests) THEN
  RAISE EXCEPTION 'Revoked session still has access';
 END IF;
END
$stale$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $public$
BEGIN
 IF EXISTS(SELECT 1 FROM public.list_beta_duel_leaderboard(50,10)) THEN
  RAISE EXCEPTION 'Unexpected public rank from aborted duel';
 END IF;
END
$public$;
RESET ROLE;
ROLLBACK;
\echo Fresh schema and combined release candidates passed
