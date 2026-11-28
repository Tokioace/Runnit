-- Runnit: privacy hardening for the existing live Supabase database.
-- Adds no users, reads no personal data, and does not change recorded race results.
-- WARNING: SQL permissions are authoritative; client route guards are not.
-- Review before applying to any other project.

-- No unauthenticated direct access to the four business tables.
REVOKE ALL PRIVILEGES ON TABLE
  public.users, public.ghost_runs, public.duels, public.duel_results
FROM anon;

-- Usernames may be shown to other signed-in players, but stored location,
-- city, country and registration metadata are NEVER available via direct SELECT.
REVOKE SELECT ON TABLE public.users FROM PUBLIC, authenticated;
GRANT SELECT (id, username) ON TABLE public.users TO authenticated;

-- Read of other players' full ghost history is not required by the UI:
-- the limited leaderboard RPC below provides the intended scoreboard.
DROP POLICY IF EXISTS "Ghost runs readable by authenticated" ON public.ghost_runs;
DROP POLICY IF EXISTS "Read own ghost runs" ON public.ghost_runs;
CREATE POLICY "Read own ghost runs" ON public.ghost_runs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Matched or finished duels are visible only to their participants.
-- Open duels remain visible to logged-in users for nearby matchmaking.
DROP POLICY IF EXISTS "Read open duels" ON public.duels;
CREATE POLICY "Read open or participating duels" ON public.duels
  FOR SELECT TO authenticated
  USING (
    status = 'open'
    OR host_user_id = (SELECT auth.uid())
    OR challenger_user_id = (SELECT auth.uid())
  );

-- Existing OAuth/email signups must not expose an email prefix as a nickname.
-- Keep the auth trigger working; chosen metadata display_name is optional.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  nickname text;
BEGIN
  nickname := NULLIF(LEFT(BTRIM(NEW.raw_user_meta_data ->> 'display_name'), 24), '');
  INSERT INTO public.users (id, username, joined_at)
  VALUES (NEW.id, COALESCE(nickname, 'Runnit-Läufer'), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Leaderboards may show a runner's nickname and time, never exact user
-- coordinates or internal user identity. Existing return shape is preserved
-- for the current mobile UI (which falls back to the requested city's center).
CREATE OR REPLACE FUNCTION public.get_top_ghost_runs(
  city_name text,
  limit_count integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  time_ms integer,
  user_lat double precision,
  user_lng double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT gr.id,
         NULL::uuid AS user_id,
         COALESCE(u.username, 'runner')::text AS username,
         gr.time_ms,
         NULL::double precision AS user_lat,
         NULL::double precision AS user_lng
  FROM public.ghost_runs AS gr
  LEFT JOIN public.users AS u ON u.id = gr.user_id
  WHERE auth.uid() IS NOT NULL
    AND gr.city = city_name
  ORDER BY gr.time_ms ASC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(limit_count, 100), 100));
$function$;

-- Full duel telemetry is available only to participants of that exact duel.
-- A participant may see the opponent's race statistics, but NOT the
-- opponent's potentially sensitive raw metrics_json payload.
CREATE OR REPLACE FUNCTION public.get_duel_results(p_duel_id uuid)
RETURNS TABLE (
  user_id uuid,
  username text,
  time_ms integer,
  steps_count integer,
  step_length_m_avg double precision,
  max_speed_mps double precision,
  max_accel_mps2 double precision,
  distance_m double precision,
  metrics_json jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
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
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.duels AS d
      WHERE d.id = p_duel_id
        AND (d.host_user_id = auth.uid() OR d.challenger_user_id = auth.uid())
    )
  ORDER BY r.created_at ASC;
$function$;

-- Server-side race-result submission is limited to actual duel participants
-- after both runners have started; the browser's login gate alone is insufficient.
-- This is NOT a GPS-verification or anti-cheat mechanism.
CREATE OR REPLACE FUNCTION public.submit_duel_result(
  p_duel_id uuid,
  p_time_ms integer,
  p_steps_count integer DEFAULT NULL,
  p_step_length_m_avg double precision DEFAULT NULL,
  p_max_speed_mps double precision DEFAULT NULL,
  p_max_accel_mps2 double precision DEFAULT NULL,
  p_distance_m double precision DEFAULT NULL,
  p_metrics_json jsonb DEFAULT NULL
)
RETURNS public.duel_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_result public.duel_results;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.duels AS d
    WHERE d.id = p_duel_id
      AND (d.host_user_id = auth.uid() OR d.challenger_user_id = auth.uid())
      AND d.start_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Not an active duel participant';
  END IF;
  IF p_time_ms IS NULL OR p_time_ms <= 0 THEN
    RAISE EXCEPTION 'Invalid time';
  END IF;
  INSERT INTO public.duel_results (
    duel_id, user_id, time_ms,
    steps_count, step_length_m_avg, max_speed_mps, max_accel_mps2, distance_m, metrics_json
  ) VALUES (
    p_duel_id, auth.uid(), p_time_ms,
    p_steps_count, p_step_length_m_avg, p_max_speed_mps, p_max_accel_mps2, p_distance_m, p_metrics_json
  )
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$function$;

-- Not a SECURITY DEFINER function, but explicitly fix its search_path and
-- avoid exposing matchmaking before login.
ALTER FUNCTION public.get_duels_nearby(double precision, double precision, double precision)
  SET search_path = pg_catalog, public;

-- SECURITY DEFINER app functions must not be callable by unauthenticated
-- API clients. The auth trigger does not need direct EXECUTE permission.
REVOKE EXECUTE ON FUNCTION
  public.handle_new_auth_user(),
  public.get_top_ghost_runs(text, integer),
  public.get_duel_results(uuid),
  public.join_duel(uuid),
  public.ready_for_duel(uuid),
  public.submit_duel_result(uuid, integer, integer, double precision, double precision, double precision, double precision, jsonb),
  public.get_duels_nearby(double precision, double precision, double precision)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.get_top_ghost_runs(text, integer),
  public.get_duel_results(uuid),
  public.join_duel(uuid),
  public.ready_for_duel(uuid),
  public.submit_duel_result(uuid, integer, integer, double precision, double precision, double precision, double precision, jsonb),
  public.get_duels_nearby(double precision, double precision, double precision)
TO authenticated;
