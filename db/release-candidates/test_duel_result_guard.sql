-- Run ONLY in a disposable empty PostgreSQL database using psql.
-- psql -X -v ON_ERROR_STOP=1 -f db/release-candidates/test_duel_result_guard.sql
-- The fixture intentionally uses a simplified schema, not production data.
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.actor',true),'')::uuid
$$;
CREATE TABLE public.duels (
  id uuid PRIMARY KEY, host_user_id uuid, challenger_user_id uuid,
  target_distance_m integer, start_at timestamptz, status text
);
CREATE TABLE public.duel_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid, user_id uuid, time_ms integer NOT NULL, steps_count integer,
  step_length_m_avg double precision, max_speed_mps double precision,
  max_accel_mps2 double precision, distance_m double precision, metrics_json jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_results ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
\ir duel_result_guard.sql

INSERT INTO public.duels VALUES
 ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012',50,statement_timestamp()-interval '20 seconds','matched'),
 ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012',100,statement_timestamp()+interval '20 seconds','matched');
-- Check real role permissions, not just the function owner's privileges.
SET LOCAL ROLE anon;
DO $anon$
BEGIN
  BEGIN
    PERFORM public.submit_duel_result('00000000-0000-4000-8000-000000000001',6000);
    RAISE EXCEPTION 'anonymous caller accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$anon$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $direct$
BEGIN
  BEGIN
    INSERT INTO public.duel_results(time_ms) VALUES (1);
    RAISE EXCEPTION 'direct authenticated insert accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('test.actor','',true);
  BEGIN
    PERFORM public.submit_duel_result('00000000-0000-4000-8000-000000000001',6000);
    RAISE EXCEPTION 'missing identity accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$direct$;
RESET ROLE;
DO $test$
DECLARE
  d uuid := '00000000-0000-4000-8000-000000000001';
  r public.duel_results;
BEGIN
  IF has_function_privilege('anon','public.submit_duel_result(uuid,integer,integer,double precision,double precision,double precision,double precision,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'anonymous execute is permitted';
  END IF;
  IF has_table_privilege('authenticated','public.duel_results','INSERT') THEN
    RAISE EXCEPTION 'direct result insert is permitted';
  END IF;
  PERFORM set_config('test.actor','00000000-0000-4000-8000-000000000013',true);
  BEGIN
    PERFORM public.submit_duel_result(d,6000);
    RAISE EXCEPTION 'outsider accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('test.actor','00000000-0000-4000-8000-000000000011',true);
  BEGIN
    PERFORM public.submit_duel_result(d,1);
    RAISE EXCEPTION 'impossible time accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.submit_duel_result(d,1000000);
    RAISE EXCEPTION 'future finish accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.submit_duel_result('00000000-0000-4000-8000-000000000002',8000);
    RAISE EXCEPTION 'prestart finish accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  r := public.submit_duel_result(d,6000,0,100,'NaN'::double precision,'Infinity'::double precision,51,
    '{"samplesUsed":7,"latitude":12.34,"verification":"verified","measurement":"gps-displacement-v1","avgAccuracyM":3}'::jsonb);
  IF r.time_ms IS DISTINCT FROM 6000 OR r.steps_count IS DISTINCT FROM 0
     OR r.step_length_m_avg IS NOT NULL OR r.max_speed_mps IS NOT NULL OR r.max_accel_mps2 IS NOT NULL
     OR r.metrics_json IS DISTINCT FROM '{"samplesUsed":7,"verification":"unverified","measurement":"gps-displacement-v1","avgAccuracyM":3}'::jsonb THEN
    RAISE EXCEPTION 'optional diagnostic sanitization failed';
  END IF;
  IF (SELECT status FROM public.duels WHERE id=d) IS DISTINCT FROM 'matched' THEN
    RAISE EXCEPTION 'completed prematurely';
  END IF;
  r := public.submit_duel_result(d,7000);
  IF r.time_ms IS DISTINCT FROM 6000 THEN RAISE EXCEPTION 'retry overwrote result'; END IF;
  PERFORM set_config('test.actor','00000000-0000-4000-8000-000000000012',true);
  r := public.submit_duel_result(d,6500);
  IF r.time_ms IS DISTINCT FROM 6500 OR
     (SELECT status FROM public.duels WHERE id=d) IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'two-player completion failed';
  END IF;
END
$test$;
-- Invoke the RPC with real authenticated privileges on a separate duel.
INSERT INTO public.duels VALUES
 ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012',75,statement_timestamp()-interval '30 seconds','matched');
SET LOCAL ROLE authenticated;
DO $role_test$
DECLARE r public.duel_results;
BEGIN
  PERFORM set_config('test.actor','00000000-0000-4000-8000-000000000011',true);
  r := public.submit_duel_result('00000000-0000-4000-8000-000000000003',9000);
  IF r.time_ms IS DISTINCT FROM 9000 OR r.id IS NULL THEN
    RAISE EXCEPTION 'authenticated RPC failed';
  END IF;
END
$role_test$;
RESET ROLE;
ROLLBACK;
