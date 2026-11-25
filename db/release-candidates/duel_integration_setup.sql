-- Isolated database fixture ONLY; never execute against production.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('test.actor',true),'')::uuid
$$;
CREATE TABLE public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), host_user_id uuid, challenger_user_id uuid,
  target_distance_m integer DEFAULT 100, start_at timestamptz, status text DEFAULT 'open',
  location text, max_distance_km integer, created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now()+interval '1 hour'), matched_at timestamptz,
  host_ready boolean DEFAULT false, challenger_ready boolean DEFAULT false
);
CREATE TABLE public.duel_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid, user_id uuid, time_ms integer NOT NULL, steps_count integer,
  step_length_m_avg double precision, max_speed_mps double precision,
  max_accel_mps2 double precision, distance_m double precision, metrics_json jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE public.users (id uuid PRIMARY KEY, username text, leaderboard_opt_in boolean DEFAULT false);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_results ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
GRANT INSERT ON public.duels TO authenticated;
CREATE POLICY host_insert ON public.duels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_user_id AND status = 'open');

GRANT SELECT ON public.duels TO authenticated;
CREATE POLICY read_duels ON public.duels FOR SELECT TO authenticated
 USING (status='open' OR host_user_id=auth.uid() OR challenger_user_id=auth.uid());
CREATE UNIQUE INDEX duels_one_inflight_host_uidx ON public.duels(host_user_id)
 WHERE host_user_id IS NOT NULL AND status IN ('open','matched');

-- Existing lifecycle and readiness RPCs from checked-in source.
CREATE OR REPLACE FUNCTION public.join_duel(duel_id uuid)
RETURNS public.duels
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
DECLARE
  v_duel public.duels;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Login required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_duel
  FROM public.duels
  WHERE id = join_duel.duel_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Duel not found';
  END IF;
  IF v_duel.status <> 'open' OR v_duel.expires_at <= statement_timestamp() THEN
    RAISE EXCEPTION 'Challenge expired or unavailable'
      USING ERRCODE = '23514';
  END IF;
  IF v_duel.host_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Host cannot join own duel'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.duels
  SET challenger_user_id = auth.uid(), status = 'matched'
  WHERE id = duel_id AND status = 'open'
    AND expires_at > statement_timestamp()
    AND challenger_user_id IS NULL
  RETURNING * INTO v_duel;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Duel was already joined or expired'
      USING ERRCODE = '23514';
  END IF;
  RETURN v_duel;
END;
$fn$;


REVOKE ALL ON FUNCTION public.join_duel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_duel(uuid) TO authenticated;
\ir cancellation.sql
\ir ready.sql
\ir abort.sql
CREATE TRIGGER runnit_duel_lifecycle_guard BEFORE INSERT OR UPDATE ON public.duels
 FOR EACH ROW EXECUTE FUNCTION public.runnit_duel_lifecycle_guard();

-- Activate both candidates in this disposable database, not in Supabase.
\ir duel_result_guard.sql
\ir beta_ranking_guard.sql

INSERT INTO public.users(id,username,leaderboard_opt_in) VALUES
 ('00000000-0000-4000-8000-000000000011','Alpha',true),
 ('00000000-0000-4000-8000-000000000012','Beta',true),
 ('00000000-0000-4000-8000-000000000013','Private',false);
SET ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000011',false);
INSERT INTO public.duels(host_user_id,location,max_distance_km,target_distance_m,status)
 VALUES ('00000000-0000-4000-8000-000000000011','fixture',1,50,'open')
 RETURNING id AS duel_id \gset
SELECT set_config('test.duel',:'duel_id',false);
DO $test$
BEGIN
  BEGIN
    INSERT INTO public.duels(host_user_id,location,max_distance_km,target_distance_m,status)
      VALUES (auth.uid(),'fixture',1,50,'open');
    RAISE EXCEPTION 'duplicate active event allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.join_duel(current_setting('test.duel')::uuid);
    RAISE EXCEPTION 'host joined own event';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$test$;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000012',false);
SELECT public.join_duel(:'duel_id');
DO $test$
DECLARE r public.duels;
BEGIN
  r:=public.ready_for_duel(current_setting('test.duel')::uuid);
  IF NOT r.challenger_ready OR r.host_ready OR r.start_at IS NOT NULL THEN
    RAISE EXCEPTION 'one Ready started the race';
  END IF;
END
$test$;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000013',false);
DO $test$
BEGIN
  BEGIN
    PERFORM public.ready_for_duel(current_setting('test.duel')::uuid);
    RAISE EXCEPTION 'outsider became ready';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$test$;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000011',false);
DO $test$
DECLARE r public.duels; again public.duels;
BEGIN
  r:=public.ready_for_duel(current_setting('test.duel')::uuid);
  IF NOT r.host_ready OR NOT r.challenger_ready OR r.start_at IS NULL
      OR r.start_at IS DISTINCT FROM statement_timestamp()+interval '10 seconds' THEN
    RAISE EXCEPTION 'two Ready did not schedule server countdown';
  END IF;
  again:=public.ready_for_duel(r.id);
  IF again.start_at IS DISTINCT FROM r.start_at THEN RAISE EXCEPTION 'Ready retry changed start'; END IF;
  BEGIN
    PERFORM public.submit_duel_result(r.id,5500);
    RAISE EXCEPTION 'prestart finish accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$test$;
RESET ROLE;
-- The shell runner waits for this real countdown plus a plausible 50 m time.
