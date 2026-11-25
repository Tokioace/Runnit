-- Test-only actual-schema fixture, after the completed-race/erasure rehearsal.
-- Execute the original cleanup function and its privileges, not cron scheduling.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database() <> 'runnit_schema_test' OR current_user <> 'postgres'
 OR NOT public.runnit_test_erasure_gate() OR EXISTS(SELECT 1 FROM public.duels)
 OR EXISTS(SELECT 1 FROM public.duel_results) THEN
   RAISE EXCEPTION 'Disposable schema rehearsal required';
 END IF;
END
$guard$;
BEGIN;
\ir ../../runnit-cleanup-function.sql
-- Use one stable transaction clock for exact inclusive deadline tests.
-- The seeded timestamps represent historical rows; production triggers are
-- bypassed ONLY for fixture INSERT, then immediately restored before testing.
CREATE TEMP TABLE cleanup_cases (
 label text PRIMARY KEY, host uuid NOT NULL DEFAULT gen_random_uuid(),
 duel uuid NOT NULL DEFAULT gen_random_uuid(), initial_status text NOT NULL,
 expiry_offset interval NOT NULL, matched_offset interval, start_offset interval,
 expected_status text NOT NULL
);
INSERT INTO cleanup_cases(label,initial_status,expiry_offset,matched_offset,start_offset,expected_status) VALUES
 ('open-future','open',interval '1 minute',NULL,NULL,'open'),
 ('open-boundary','open',interval '0 seconds',NULL,NULL,'expired'),
 ('open-past','open',interval '-1 minute',NULL,NULL,'expired'),
 ('matched-recent-expired-lobby','matched',interval '-5 minutes',interval '-10 minutes',NULL,'matched'),
 ('matched-before-deadline','matched',interval '-1 minute',interval '-29 minutes',NULL,'matched'),
 ('matched-boundary','matched',interval '-1 minute',interval '-30 minutes',NULL,'abandoned'),
 ('matched-overdue','matched',interval '-1 minute',interval '-31 minutes',NULL,'abandoned'),
 ('countdown','matched',interval '-3 hours',interval '-2 hours',interval '10 seconds','matched'),
 ('running-recent','matched',interval '-2 hours',interval '-2 hours',interval '-1 hour','matched'),
 ('running-before-deadline','matched',interval '-5 hours',interval '-4 hours 10 minutes',interval '-3 hours 59 minutes','matched'),
 ('running-boundary','matched',interval '-5 hours',interval '-4 hours 10 minutes',interval '-4 hours','abandoned'),
 ('running-overdue','matched',interval '-6 hours',interval '-5 hours',interval '-4 hours 1 minute','abandoned'),
 ('cancelled','cancelled',interval '-6 hours',NULL,NULL,'cancelled'),
 ('already-expired','expired',interval '-6 hours',NULL,NULL,'expired'),
 ('already-abandoned','abandoned',interval '-6 hours',interval '-5 hours',interval '-4 hours','abandoned');
INSERT INTO auth.users(id,email,raw_user_meta_data)
 SELECT host,label||'@example.invalid',jsonb_build_object('display_name','Fixture') FROM cleanup_cases;
-- One synthetic challenger, never a host in the test.
INSERT INTO auth.users(id,email) VALUES('00000000-0000-4000-8000-000000000099','cleanup-peer@example.invalid');
ALTER TABLE public.duels DISABLE TRIGGER USER;
INSERT INTO public.duels(id,host_user_id,challenger_user_id,location,max_distance_km,
 target_distance_m,status,created_at,expires_at,matched_at,start_at)
 SELECT duel,host,CASE WHEN initial_status IN ('matched','abandoned')
 THEN '00000000-0000-4000-8000-000000000099'::uuid ELSE NULL END,
 ST_GeogFromText('SRID=4326;POINT(0 0)'),1,50,initial_status,
 now()+expiry_offset-interval '60 minutes',now()+expiry_offset,
 now()+matched_offset,now()+start_offset FROM cleanup_cases;
ALTER TABLE public.duels ENABLE TRIGGER USER;
-- Verify that the actual lifecycle trigger is in effect and no auth claim
-- is present when running as the scheduler's trusted database owner.
SELECT set_config('test.actor','',true);
SELECT set_config('test.session','',true);
DO $acl$
BEGIN
 IF auth.uid() IS NOT NULL OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE
 tgrelid='public.duels'::regclass AND tgname='runnit_duel_lifecycle_guard' AND tgenabled='O')
 OR has_function_privilege('anon','public.runnit_close_stale_duels()','EXECUTE')
 OR has_function_privilege('authenticated','public.runnit_close_stale_duels()','EXECUTE') THEN
   RAISE EXCEPTION 'Cleanup context or privileges unsafe';
 END IF;
END
$acl$;
SET LOCAL ROLE authenticated;
DO $denial$
BEGIN
 BEGIN
  PERFORM public.runnit_close_stale_duels();
  RAISE EXCEPTION 'Client invoked cleanup';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END
$denial$;
RESET ROLE;
CREATE TEMP TABLE cleanup_before AS
 SELECT id,to_jsonb(d)-'status' AS immutable_fields FROM public.duels d;
SELECT public.runnit_close_stale_duels();
DO $results$
BEGIN
 IF EXISTS(SELECT 1 FROM cleanup_cases c LEFT JOIN public.duels d ON d.id=c.duel
 WHERE d.status IS DISTINCT FROM c.expected_status) THEN
   RAISE EXCEPTION 'Cleanup deadline or lifecycle mismatch: %',
    (SELECT string_agg(c.label,', ') FROM cleanup_cases c LEFT JOIN public.duels d ON d.id=c.duel
     WHERE d.status IS DISTINCT FROM c.expected_status);
 END IF;
 IF (SELECT count(*) FROM public.duels)<>(SELECT count(*) FROM cleanup_before)
 OR EXISTS(SELECT 1 FROM cleanup_before b LEFT JOIN public.duels d ON d.id=b.id
   WHERE (to_jsonb(d)-'status') IS DISTINCT FROM b.immutable_fields) THEN
   RAISE EXCEPTION 'Cleanup changed historical fields or deleted a duel';
 END IF;
END
$results$;
CREATE TEMP TABLE cleanup_after AS SELECT id,to_jsonb(d) AS row_data FROM public.duels d;
SELECT public.runnit_close_stale_duels();
DO $retry$
BEGIN
 IF EXISTS(SELECT 1 FROM cleanup_after a FULL JOIN public.duels d ON d.id=a.id
 WHERE to_jsonb(d) IS DISTINCT FROM a.row_data) THEN
   RAISE EXCEPTION 'Cleanup retry changed data';
 END IF;
END
$retry$;
-- Freed host slots must really be reusable; active slots stay occupied.
DO $slots$
DECLARE c record;
BEGIN
 FOR c IN SELECT * FROM cleanup_cases LOOP
   IF c.expected_status IN ('expired','abandoned') AND c.initial_status IN ('open','matched') THEN
     INSERT INTO public.duels(host_user_id,location,max_distance_km,target_distance_m,status)
       VALUES(c.host,ST_GeogFromText('SRID=4326;POINT(0 0)'),1,50,'open');
   ELSIF c.expected_status IN ('open','matched') THEN
     BEGIN
       INSERT INTO public.duels(host_user_id,location,max_distance_km,target_distance_m,status)
         VALUES(c.host,ST_GeogFromText('SRID=4326;POINT(0 0)'),1,50,'open');
       RAISE EXCEPTION 'Active host slot released: %',c.label;
     EXCEPTION WHEN unique_violation THEN NULL;
     END;
   END IF;
 END LOOP;
END
$slots$;
ROLLBACK;
\echo Stale duel cleanup boundaries, privileges and retry passed
