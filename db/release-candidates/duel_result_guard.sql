-- RELEASE CANDIDATE ONLY: not a migration and not applied to any database.
-- Promote through a generated Supabase migration only after isolated SQL tests and review.
-- Runnit 1v1: race results must be submitted once per athlete, serially.
-- Keeps the existing participant-only RPC signature and marks the duel
-- completed atomically when both players have a recorded finish.
CREATE UNIQUE INDEX IF NOT EXISTS duel_results_one_per_runner_uidx
ON public.duel_results(duel_id, user_id);

CREATE OR REPLACE FUNCTION public.submit_duel_result(
  p_duel_id uuid,
  p_time_ms integer,
  p_steps_count integer DEFAULT NULL,
  p_step_length_m_avg double precision DEFAULT NULL,
  p_max_speed_mps double precision DEFAULT NULL,
  p_max_accel_mps2 double precision DEFAULT NULL,
  p_distance_m double precision DEFAULT NULL,
  p_metrics_json jsonb DEFAULT NULL
) RETURNS public.duel_results
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $finish$
DECLARE
  v_duel public.duels;
  v_result public.duel_results;
  v_actor uuid := auth.uid();
  v_elapsed_ms numeric;
  v_diagnostics jsonb := '{}'::jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Login required' USING ERRCODE='42501';
  END IF;
  -- The row lock serializes both finish submissions, eliminating a race
  -- where each phone inserts but neither observes the other's transaction.
  SELECT * INTO v_duel FROM public.duels
  WHERE id = p_duel_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Duel not found' USING ERRCODE='P0002';
  END IF;
  IF v_actor IS DISTINCT FROM v_duel.host_user_id
     AND v_actor IS DISTINCT FROM v_duel.challenger_user_id THEN
    RAISE EXCEPTION 'Not a duel participant' USING ERRCODE='42501';
  END IF;

  -- A retry after losing connection should never duplicate or overwrite
  -- a participant's original result, even when the duel is now completed.
  SELECT * INTO v_result FROM public.duel_results
   WHERE duel_id=p_duel_id AND user_id=v_actor;
  IF FOUND THEN RETURN v_result; END IF;

  IF v_duel.status IS DISTINCT FROM 'matched'
     OR v_duel.start_at IS NULL
     OR v_duel.start_at > statement_timestamp()
     OR v_duel.challenger_user_id IS NULL THEN
    RAISE EXCEPTION 'Duel has not started or is no longer active'
      USING ERRCODE='23514';
  END IF;
  -- Server-owned target and clock. These intentionally generous bounds reject
  -- impossible claims; they do not verify athletic authenticity.
  IF v_duel.target_distance_m IS NULL
     OR v_duel.target_distance_m NOT IN (50,75,100) THEN
    RAISE EXCEPTION 'Invalid race distance' USING ERRCODE='23514';
  END IF;
  v_elapsed_ms := EXTRACT(EPOCH FROM (statement_timestamp() - v_duel.start_at)) * 1000;
  IF p_time_ms IS NULL
     OR p_time_ms < CEIL(v_duel.target_distance_m * 1000.0 / 15)
     OR p_time_ms > v_elapsed_ms + 2000 THEN
    RAISE EXCEPTION 'Invalid race time' USING ERRCODE='23514';
  END IF;

  -- Ignore invalid optional sensor data rather than punishing a runner for
  -- sensor dropout. PostgreSQL NaN and infinities fail these finite bounds.
  IF p_steps_count IS NOT NULL AND p_steps_count NOT BETWEEN 0 AND 10000 THEN
    p_steps_count := NULL;
  END IF;
  IF p_step_length_m_avg IS NOT NULL AND p_step_length_m_avg NOT BETWEEN 0 AND 10 THEN
    p_step_length_m_avg := NULL;
  END IF;
  IF p_steps_count IS NULL OR p_steps_count = 0 THEN
    p_step_length_m_avg := NULL;
  END IF;
  IF p_max_speed_mps IS NOT NULL AND p_max_speed_mps NOT BETWEEN 0 AND 15 THEN
    p_max_speed_mps := NULL;
  END IF;
  IF p_max_accel_mps2 IS NOT NULL AND p_max_accel_mps2 NOT BETWEEN 0 AND 60 THEN
    p_max_accel_mps2 := NULL;
  END IF;
  IF p_distance_m IS NOT NULL AND p_distance_m NOT BETWEEN 0 AND 1000 THEN
    p_distance_m := NULL;
  END IF;

  -- Store only small, typed, aggregate diagnostic fields, never arbitrary
  -- client JSON, location traces, tokens or client-declared verification.
  IF jsonb_typeof(p_metrics_json) = 'object' THEN
    SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
      INTO v_diagnostics
    FROM jsonb_each(p_metrics_json) AS e
    WHERE (
      e.key = 'avgAccuracyM' AND jsonb_typeof(e.value) = 'number'
      AND e.value BETWEEN '0'::jsonb AND '1000'::jsonb
    ) OR (
      e.key IN ('samplesUsed','rejectedSamples','staleFixes')
      AND jsonb_typeof(e.value) = 'number'
      AND e.value BETWEEN '0'::jsonb AND '100000'::jsonb
    ) OR (
      e.key = 'motionCoverage' AND jsonb_typeof(e.value) = 'number'
      AND e.value BETWEEN '0'::jsonb AND '1'::jsonb
    ) OR (
      e.key IN ('motionSamples','motionGapCount') AND jsonb_typeof(e.value) = 'number'
      AND e.value BETWEEN '0'::jsonb AND '30000'::jsonb
    ) OR (
      e.key = 'sprintCadenceSpm' AND jsonb_typeof(e.value) = 'number'
      AND e.value BETWEEN '140'::jsonb AND '300'::jsonb
    ) OR (
      e.key = 'motionEvidence' AND e.value IN ('"consistent"'::jsonb, '"uncertain"'::jsonb, '"incomplete"'::jsonb)
    ) OR (
      e.key = 'usedPrestartFix' AND jsonb_typeof(e.value) = 'boolean'
    ) OR (
      e.key = 'measurement' AND e.value = '"gps-displacement-v1"'::jsonb
    );
  END IF;
  v_diagnostics := v_diagnostics || '{"verification":"unverified"}'::jsonb;

  INSERT INTO public.duel_results (
    duel_id, user_id, time_ms, steps_count, step_length_m_avg,
    max_speed_mps, max_accel_mps2, distance_m, metrics_json
  ) VALUES (
    p_duel_id, v_actor, p_time_ms, p_steps_count, p_step_length_m_avg,
    p_max_speed_mps, p_max_accel_mps2, p_distance_m, v_diagnostics
  ) RETURNING * INTO v_result;

  IF EXISTS (
    SELECT 1 FROM public.duel_results
    WHERE duel_id=p_duel_id AND user_id=v_duel.host_user_id
  ) AND EXISTS (
    SELECT 1 FROM public.duel_results
    WHERE duel_id=p_duel_id AND user_id=v_duel.challenger_user_id
  ) THEN
    UPDATE public.duels
       SET status='completed'
     WHERE id=p_duel_id AND status='matched';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Duel completion not confirmed'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN v_result;
END;
$finish$;

REVOKE ALL ON FUNCTION public.submit_duel_result(uuid,integer,integer,double precision,double precision,double precision,double precision,jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_duel_result(uuid,integer,integer,double precision,double precision,double precision,double precision,jsonb)
TO authenticated;

-- Players must use the checked RPC, never edit/inject individual result rows.
-- SELECT remains available under existing participant-only result RLS and RPC.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.duel_results FROM authenticated;

-- The current UI creates an open event using exactly these five columns.
-- Prevent a client from seeding the start clock, ready flags, challenger,
-- ID or lifecycle timestamps on INSERT. Existing join/ready RPCs own those.
REVOKE INSERT ON TABLE public.duels FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, host_user_id, location, max_distance_km, status, created_at,
  challenger_user_id, target_distance_m, host_ready, challenger_ready, start_at,
  expires_at, matched_at) ON TABLE public.duels FROM PUBLIC, anon, authenticated;
GRANT INSERT (host_user_id, location, max_distance_km, target_distance_m, status)
  ON TABLE public.duels TO authenticated;
