-- Fresh transaction on the disposable CI fixture after erasure tests.
BEGIN;
CREATE SCHEMA runnit_session_fixture;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,not_after timestamptz);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $jwt$
 SELECT jsonb_build_object('session_id',current_setting('test.session',true))
$jwt$;
CREATE TABLE public.ghost_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,city text,time_ms integer);
CREATE TABLE public.ghost_run_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid);
CREATE TABLE public.runner_stats_preferences(user_id uuid PRIMARY KEY);
ALTER TABLE public.ghost_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_run_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runner_stats_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.users,public.ghost_runs TO authenticated;
CREATE POLICY fixture_profile_read ON public.users FOR SELECT TO authenticated USING(true);
CREATE POLICY fixture_ghost_read ON public.ghost_runs FOR SELECT TO authenticated USING(user_id=auth.uid());
INSERT INTO auth.users SELECT id FROM public.users;
\ir account_deletion_requests.sql
\ir account_erasure_guard.sql
\ir shared_duel_erasure.sql
\ir session_access_guard.sql
INSERT INTO auth.sessions VALUES
 ('10000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000011',NULL),
 ('10000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000012',NULL),
 ('10000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000011',now()-interval '1 minute');
INSERT INTO public.ghost_runs(user_id,city,time_ms)
 VALUES ('00000000-0000-4000-8000-000000000011','Fixture',6000);
-- Existing lifecycle fixture has two completed results and one open event.
SELECT set_config('test.completed',(SELECT id::text FROM public.duels WHERE status='completed' LIMIT 1),true);
SELECT set_config('test.open',(SELECT id::text FROM public.duels WHERE status='open' LIMIT 1),true);
SET LOCAL ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000011',true);
SELECT set_config('test.session','10000000-0000-4000-8000-000000000011',true);
DO $test$
BEGIN
 IF NOT runnit_session_private.has_live_session()
    OR NOT EXISTS(SELECT 1 FROM public.users)
    OR NOT EXISTS(SELECT 1 FROM public.get_top_ghost_runs('Fixture'))
    OR NOT EXISTS(SELECT 1 FROM public.get_duel_results(current_setting('test.completed')::uuid)) THEN
  RAISE EXCEPTION 'valid session denied';
 END IF;
END
$test$;
DO $test$
DECLARE claim text;
BEGIN
 FOREACH claim IN ARRAY ARRAY['','bad','10000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000013'] LOOP
  PERFORM set_config('test.session',claim,true);
  IF runnit_session_private.has_live_session() OR EXISTS(SELECT 1 FROM public.users)
     OR EXISTS(SELECT 1 FROM public.get_top_ghost_runs('Fixture')) THEN
   RAISE EXCEPTION 'invalid session accepted';
  END IF;
 END LOOP;
END
$test$;
RESET ROLE;
-- Session revoked while the token still carries the same claims.
DELETE FROM auth.sessions WHERE id='10000000-0000-4000-8000-000000000011';
SET LOCAL ROLE authenticated;
SELECT set_config('test.session','10000000-0000-4000-8000-000000000011',true);
DO $test$
BEGIN
 IF runnit_session_private.has_live_session() OR EXISTS(SELECT 1 FROM public.users)
    OR EXISTS(SELECT 1 FROM public.duels) OR EXISTS(SELECT 1 FROM public.ghost_runs)
    OR EXISTS(SELECT 1 FROM public.get_duel_results(current_setting('test.completed')::uuid))
    OR EXISTS(SELECT 1 FROM public.get_top_ghost_runs('Fixture')) THEN
  RAISE EXCEPTION 'revoked session can still read protected data';
 END IF;
 BEGIN
  INSERT INTO public.account_deletion_requests(user_id) VALUES(auth.uid());
  RAISE EXCEPTION 'revoked session created request';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.join_duel(current_setting('test.open')::uuid);
  RAISE EXCEPTION 'revoked session joined';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.ready_for_duel(current_setting('test.completed')::uuid);
  RAISE EXCEPTION 'revoked session ready';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.abort_duel(current_setting('test.completed')::uuid);
  RAISE EXCEPTION 'revoked session aborted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.submit_duel_result(current_setting('test.completed')::uuid,5500);
  RAISE EXCEPTION 'revoked session retried finish';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$test$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $test$
BEGIN
 IF (SELECT count(*) FROM public.list_beta_duel_leaderboard(50,100))<>2 THEN
  RAISE EXCEPTION 'public opt-in ranking changed';
 END IF;
END
$test$;
RESET ROLE;
ROLLBACK;
