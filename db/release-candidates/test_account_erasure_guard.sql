-- Synthetic FK graph only. Run after other fixtures in disposable CI.
BEGIN;
TRUNCATE public.duel_results, public.duels, public.users;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE public.ghost_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE);
CREATE TABLE public.ghost_run_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE);
CREATE TABLE public.runner_stats_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
ALTER TABLE public.duels
 ADD FOREIGN KEY(host_user_id) REFERENCES public.users(id) ON DELETE CASCADE,
 ADD FOREIGN KEY(challenger_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.duel_results
 ADD FOREIGN KEY(user_id) REFERENCES public.users(id) ON DELETE CASCADE,
 ADD FOREIGN KEY(duel_id) REFERENCES public.duels(id) ON DELETE CASCADE;
GRANT INSERT, DELETE ON public.users TO authenticated;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_profile_insert ON public.users FOR INSERT TO authenticated
 WITH CHECK (auth.uid()=id);
CREATE POLICY fixture_profile_delete ON public.users FOR DELETE TO authenticated
 USING (auth.uid()=id);
\ir account_deletion_requests.sql
\ir account_erasure_guard.sql
INSERT INTO auth.users VALUES
 ('00000000-0000-4000-8000-000000000011'),
 ('00000000-0000-4000-8000-000000000012'),
 ('00000000-0000-4000-8000-000000000013');
INSERT INTO public.users(id,username,leaderboard_opt_in)
 SELECT id,'Synthetic',true FROM auth.users;
INSERT INTO auth.sessions(user_id) SELECT id FROM auth.users;
INSERT INTO public.ghost_runs(user_id) SELECT id FROM auth.users;
INSERT INTO public.ghost_run_sessions(user_id) SELECT id FROM auth.users;
INSERT INTO public.runner_stats_preferences(user_id) SELECT id FROM auth.users;
INSERT INTO public.account_deletion_requests(user_id) SELECT id FROM auth.users;
-- Insert open events via the existing lifecycle trigger.
INSERT INTO public.duels(id,host_user_id,location,max_distance_km,target_distance_m,status)
 VALUES ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000011','fixture',1,50,'open'),
 ('00000000-0000-4000-8000-000000000023','00000000-0000-4000-8000-000000000013','fixture',1,50,'open');
-- Join the first event as another runner and seed synthetic own results.
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000012',true);
SELECT public.join_duel('00000000-0000-4000-8000-000000000021');
INSERT INTO public.duel_results(duel_id,user_id,time_ms)
 VALUES ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000011',6000),
 ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000012',6500);
SET LOCAL ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000013',true);
DO $test$
BEGIN
 IF has_table_privilege('authenticated','public.users','DELETE') THEN
   RAISE EXCEPTION 'direct profile delete still granted';
 END IF;
 IF has_schema_privilege('authenticated','runnit_private','USAGE')
    OR EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='runnit_private' AND p.proname='guard_profile_erasure'
        AND has_function_privilege('authenticated',p.oid,'EXECUTE')) THEN
   RAISE EXCEPTION 'private erasure guard exposed';
 END IF;
 BEGIN
   DELETE FROM public.users WHERE id=auth.uid();
   RAISE EXCEPTION 'client profile delete accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$test$;
RESET ROLE;
DO $test$
DECLARE actor uuid;
BEGIN
 FOREACH actor IN ARRAY ARRAY['00000000-0000-4000-8000-000000000011'::uuid,
                              '00000000-0000-4000-8000-000000000012'::uuid] LOOP
   BEGIN
     DELETE FROM auth.users WHERE id=actor;
     RAISE EXCEPTION 'shared-account erasure allowed';
   EXCEPTION WHEN check_violation THEN NULL;
   END;
   IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=actor)
      OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=actor)
      OR NOT EXISTS(SELECT 1 FROM public.account_deletion_requests WHERE user_id=actor)
      OR NOT EXISTS(SELECT 1 FROM auth.sessions WHERE user_id=actor) THEN
      RAISE EXCEPTION 'blocked erasure did not roll back completely';
   END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.duel_results)<>2 THEN RAISE EXCEPTION 'opponent data lost'; END IF;
END
$test$;
-- Supported case: no other participant/results. Simulate the admin API's
-- database deletion with the fixture owner, not an actual Supabase user.
DELETE FROM auth.users WHERE id='00000000-0000-4000-8000-000000000013';
DO $test$
DECLARE actor uuid:='00000000-0000-4000-8000-000000000013';
BEGIN
 IF EXISTS(SELECT 1 FROM auth.users WHERE id=actor)
    OR EXISTS(SELECT 1 FROM auth.sessions WHERE user_id=actor)
    OR EXISTS(SELECT 1 FROM public.users WHERE id=actor)
    OR EXISTS(SELECT 1 FROM public.duels WHERE host_user_id=actor OR challenger_user_id=actor)
    OR EXISTS(SELECT 1 FROM public.ghost_runs WHERE user_id=actor)
    OR EXISTS(SELECT 1 FROM public.ghost_run_sessions WHERE user_id=actor)
    OR EXISTS(SELECT 1 FROM public.runner_stats_preferences WHERE user_id=actor)
    OR EXISTS(SELECT 1 FROM public.account_deletion_requests WHERE user_id=actor) THEN
   RAISE EXCEPTION 'account-owned data not fully cascaded';
 END IF;
 IF (SELECT count(*) FROM public.users)<>2 OR (SELECT count(*) FROM public.duel_results)<>2 THEN
   RAISE EXCEPTION 'unrelated data changed';
 END IF;
END
$test$;
SET LOCAL ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000013',true);
DO $test$
BEGIN
 BEGIN
   INSERT INTO public.users(id,username) VALUES (auth.uid(),'Stale');
   RAISE EXCEPTION 'stale identity recreated profile';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END
$test$;
RESET ROLE;
-- Upgrade the staged guard within this transaction. Existing shared race
-- is still matched and must not be deleted while live.
\ir shared_duel_erasure.sql
DO $test$
BEGIN
 BEGIN
  DELETE FROM auth.users WHERE id='00000000-0000-4000-8000-000000000011';
  RAISE EXCEPTION 'active race erased';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF EXISTS(SELECT 1 FROM public.archived_personal_duel_times) THEN RAISE EXCEPTION 'active race archived'; END IF;
END
$test$;
UPDATE public.duels SET start_at=statement_timestamp()-interval '20 seconds'
 WHERE id='00000000-0000-4000-8000-000000000021';
UPDATE public.duels SET status='completed'
 WHERE id='00000000-0000-4000-8000-000000000021';

SAVEPOINT host_erasure;
DELETE FROM auth.users WHERE id='00000000-0000-4000-8000-000000000011';
DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM public.users WHERE id='00000000-0000-4000-8000-000000000011')
    OR EXISTS(SELECT 1 FROM public.duels WHERE id='00000000-0000-4000-8000-000000000021')
    OR EXISTS(SELECT 1 FROM public.duel_results) THEN RAISE EXCEPTION 'shared original not erased'; END IF;
 IF (SELECT count(*) FROM public.archived_personal_duel_times)<>1 OR
    NOT EXISTS(SELECT 1 FROM public.archived_personal_duel_times WHERE user_id='00000000-0000-4000-8000-000000000012' AND time_ms=6500 AND target_distance_m=50) THEN
   RAISE EXCEPTION 'challenger own time lost';
 END IF;
 IF EXISTS(SELECT 1 FROM public.list_beta_duel_leaderboard(50,100)) THEN RAISE EXCEPTION 'archive leaked to public ranking'; END IF;
END
$test$;
ROLLBACK TO SAVEPOINT host_erasure;

DELETE FROM auth.users WHERE id='00000000-0000-4000-8000-000000000012';
DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM public.duel_results) OR
    (SELECT count(*) FROM public.archived_personal_duel_times)<>1 OR
    NOT EXISTS(SELECT 1 FROM public.archived_personal_duel_times WHERE user_id='00000000-0000-4000-8000-000000000011' AND time_ms=6000) THEN
   RAISE EXCEPTION 'host own time lost or original still exists';
 END IF;
END
$test$;
SET LOCAL ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000012',true);
DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM public.archived_personal_duel_times) THEN RAISE EXCEPTION 'foreign archive leaked'; END IF;
END
$test$;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000011',true);
DO $test$
BEGIN
 IF (SELECT count(*) FROM public.archived_personal_duel_times)<>1 THEN RAISE EXCEPTION 'owner archive missing'; END IF;
 BEGIN
  INSERT INTO public.archived_personal_duel_times(user_id,occurred_at,time_ms) VALUES(auth.uid(),now(),1);
  RAISE EXCEPTION 'client forged archive';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$test$;
RESET ROLE;
DELETE FROM auth.users WHERE id='00000000-0000-4000-8000-000000000011';
DO $test$
BEGIN
 IF EXISTS(SELECT 1 FROM public.archived_personal_duel_times) THEN RAISE EXCEPTION 'archive did not cascade on later account erasure'; END IF;
END
$test$;
ROLLBACK;
