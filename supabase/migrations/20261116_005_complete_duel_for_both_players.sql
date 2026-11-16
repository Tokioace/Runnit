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
  IF p_time_ms IS NULL OR p_time_ms <= 0 THEN
    RAISE EXCEPTION 'Invalid race time' USING ERRCODE='23514';
  END IF;

  INSERT INTO public.duel_results (
    duel_id, user_id, time_ms, steps_count, step_length_m_avg,
    max_speed_mps, max_accel_mps2, distance_m, metrics_json
  ) VALUES (
    p_duel_id, v_actor, p_time_ms, p_steps_count, p_step_length_m_avg,
    p_max_speed_mps, p_max_accel_mps2, p_distance_m, p_metrics_json
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
