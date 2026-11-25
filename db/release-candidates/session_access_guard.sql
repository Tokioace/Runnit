-- RELEASE CANDIDATE ONLY. Install after result, ranking and account-erasure candidates.
-- JWT signatures are validated by Supabase. Check session existence and ownership
-- against Auth; never use editable user metadata for authorization.
CREATE SCHEMA IF NOT EXISTS runnit_session_private;
REVOKE ALL ON SCHEMA runnit_session_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA runnit_session_private TO authenticated;

CREATE OR REPLACE FUNCTION runnit_session_private.has_live_session()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='pg_catalog'
AS $session$
DECLARE
  actor uuid := auth.uid();
  session_claim text := auth.jwt()->>'session_id';
BEGIN
  IF actor IS NULL OR session_claim IS NULL OR
     session_claim !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id=session_claim::uuid
    AND s.user_id=actor AND (s.not_after IS NULL OR s.not_after>statement_timestamp()));
END
$session$;
REVOKE ALL ON FUNCTION runnit_session_private.has_live_session() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION runnit_session_private.has_live_session() TO authenticated;

-- Restrictive policies are ANDed with existing ownership/access policies.
-- They do not grant access to any additional rows or columns.
CREATE POLICY runnit_live_session ON public.users AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT runnit_session_private.has_live_session()))
  WITH CHECK ((SELECT runnit_session_private.has_live_session()));
CREATE POLICY runnit_live_session ON public.duels AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT runnit_session_private.has_live_session()))
  WITH CHECK ((SELECT runnit_session_private.has_live_session()));
CREATE POLICY runnit_live_session ON public.duel_results AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT runnit_session_private.has_live_session()))
  WITH CHECK ((SELECT runnit_session_private.has_live_session()));
CREATE POLICY runnit_live_session ON public.ghost_runs AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT runnit_session_private.has_live_session()))
  WITH CHECK ((SELECT runnit_session_private.has_live_session()));
CREATE POLICY runnit_live_session ON public.ghost_run_sessions AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT runnit_session_private.has_live_session()))
  WITH CHECK ((SELECT runnit_session_private.has_live_session()));
CREATE POLICY runnit_live_session ON public.runner_stats_preferences AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT runnit_session_private.has_live_session()))
  WITH CHECK ((SELECT runnit_session_private.has_live_session()));
CREATE POLICY runnit_live_session ON public.account_deletion_requests AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT runnit_session_private.has_live_session()))
  WITH CHECK ((SELECT runnit_session_private.has_live_session()));
CREATE POLICY runnit_live_session ON public.archived_personal_duel_times AS RESTRICTIVE FOR ALL TO authenticated
  USING ((SELECT runnit_session_private.has_live_session()))
  WITH CHECK ((SELECT runnit_session_private.has_live_session()));

-- Existing privileged RPCs also need a guard because their owner bypasses RLS.
CREATE OR REPLACE FUNCTION public.abort_duel(p_duel_id uuid)
 RETURNS public.duels
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_duel public.duels;
  v_actor uuid := auth.uid();
BEGIN
  IF NOT runnit_session_private.has_live_session() THEN
    RAISE EXCEPTION 'Login required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_duel FROM public.duels WHERE id = p_duel_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Duel not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_actor IS DISTINCT FROM v_duel.host_user_id
     AND v_actor IS DISTINCT FROM v_duel.challenger_user_id THEN
    RAISE EXCEPTION 'Not a participant' USING ERRCODE = '42501';
  END IF;
  -- Idempotence if both devices try to abort simultaneously or retry.
  IF v_duel.status = 'abandoned' THEN
    RETURN v_duel;
  END IF;
  IF v_duel.status IS DISTINCT FROM 'matched' THEN
    RAISE EXCEPTION 'Only matched duels can be aborted'
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.duels SET status = 'abandoned'
  WHERE id = p_duel_id AND status = 'matched'
  RETURNING * INTO v_duel;
  IF NOT FOUND OR v_duel.status <> 'abandoned' THEN
    RAISE EXCEPTION 'Duel abort was not confirmed'
      USING ERRCODE = '23514';
  END IF;
  RETURN v_duel;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_duel_results(p_duel_id uuid)
 RETURNS TABLE(user_id uuid, username text, time_ms integer, steps_count integer, step_length_m_avg double precision, max_speed_mps double precision, max_accel_mps2 double precision, distance_m double precision, metrics_json jsonb, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT r.user_id,
         COALESCE(u.username, 'runner')::text AS username,
         r.time_ms,
         r.steps_count,
         r.step_length_m_avg,
         r.max_speed_mps,
         r.max_accel_mps2,
         r.distance_m,
         CASE WHEN r.user_id = auth.uid() THEN r.metrics_json ELSE NULL::jsonb END,
         r.created_at
  FROM public.duel_results AS r
  LEFT JOIN public.users AS u ON u.id = r.user_id
  WHERE r.duel_id = p_duel_id
    AND runnit_session_private.has_live_session()
    AND EXISTS (
      SELECT 1
      FROM public.duels AS d
      WHERE d.id = p_duel_id
        AND (d.host_user_id = auth.uid() OR d.challenger_user_id = auth.uid())
    )
  ORDER BY r.created_at ASC;
$function$;
CREATE OR REPLACE FUNCTION public.get_top_ghost_runs(city_name text, limit_count integer DEFAULT 100)
 RETURNS TABLE(id uuid, user_id uuid, username text, time_ms integer, user_lat double precision, user_lng double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT gr.id,
         NULL::uuid AS user_id,
         COALESCE(u.username, 'runner')::text AS username,
         gr.time_ms,
         NULL::double precision AS user_lat,
         NULL::double precision AS user_lng
  FROM public.ghost_runs AS gr
  LEFT JOIN public.users AS u ON u.id = gr.user_id
  WHERE runnit_session_private.has_live_session()
    AND gr.city = city_name
  ORDER BY gr.time_ms ASC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(limit_count, 100), 100));
$function$;
CREATE OR REPLACE FUNCTION public.join_duel(duel_id uuid)
 RETURNS public.duels
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_duel public.duels;
BEGIN
  IF NOT runnit_session_private.has_live_session() THEN
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
$function$;
CREATE OR REPLACE FUNCTION public.ready_for_duel(p_duel_id uuid)
 RETURNS public.duels
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_duel public.duels;
  v_actor uuid := auth.uid();
  v_is_host boolean;
begin
  if not runnit_session_private.has_live_session() then
    raise exception 'Login required' using errcode = '42501';
  end if;
  select * into v_duel
    from public.duels
    where id = p_duel_id
    for update;
  if not found then
    raise exception 'Duel not found' using errcode = 'P0002';
  end if;
  if v_duel.status is distinct from 'matched' or v_duel.challenger_user_id is null then
    raise exception 'Duel not matched' using errcode = '23514';
  end if;
  if v_actor is distinct from v_duel.host_user_id
     and v_actor is distinct from v_duel.challenger_user_id then
    raise exception 'Not a participant' using errcode = '42501';
  end if;
  -- Ready and the chosen start time are immutable once scheduled.
  if v_duel.start_at is not null then return v_duel; end if;
  v_is_host := v_actor = v_duel.host_user_id;

  update public.duels
     set host_ready = case when v_is_host then true else host_ready end,
         challenger_ready = case when not v_is_host then true else challenger_ready end,
         start_at = case
           when (v_is_host or host_ready) and (not v_is_host or challenger_ready)
             then statement_timestamp() + interval '10 seconds'
           else start_at
         end
   where id = p_duel_id and status = 'matched'
   returning * into v_duel;

  if not found then
    raise exception 'Duel unavailable' using errcode = '23514';
  end if;
  return v_duel;
end;
$function$;
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
  IF NOT runnit_session_private.has_live_session() THEN
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

REVOKE ALL ON FUNCTION public.abort_duel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abort_duel(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_duel_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_duel_results(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_top_ghost_runs(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_top_ghost_runs(text,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.join_duel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_duel(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.ready_for_duel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ready_for_duel(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_duel_result(uuid,integer,integer,double precision,double precision,double precision,double precision,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_duel_result(uuid,integer,integer,double precision,double precision,double precision,double precision,jsonb) TO authenticated;
