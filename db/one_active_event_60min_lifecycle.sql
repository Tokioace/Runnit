-- Runnit: one active hosted duel, server-authoritative 60-minute lobby,
-- and a bounded cleanup of abandoned matched duels.
-- Records remain for audit/history; 'expired' is not a physical DELETE.
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS matched_at timestamptz;

-- Existing cancelled rows are IMMUTABLE under guard_duel_cancellation,
-- so never backfill or touch their historical fields.
UPDATE public.duels
SET expires_at = coalesce(created_at, now()) + interval '60 minutes'
WHERE expires_at IS NULL AND status IS DISTINCT FROM 'cancelled';
UPDATE public.duels
SET matched_at = coalesce(created_at, now())
WHERE status = 'matched' AND matched_at IS NULL;

ALTER TABLE public.duels
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '60 minutes');
-- Legacy cancelled rows may have null expires_at, while every open/matched
-- record must be timestamped. The insert trigger sets non-null for all new rows.
ALTER TABLE public.duels
  ADD CONSTRAINT duels_active_expiry_required
  CHECK (status NOT IN ('open', 'matched') OR expires_at IS NOT NULL);

-- Existing forgotten lobbies must not block the new one-event rule.
UPDATE public.duels
SET status = 'expired'
WHERE status = 'open' AND expires_at <= now();

CREATE UNIQUE INDEX IF NOT EXISTS duels_one_inflight_host_uidx
ON public.duels(host_user_id)
WHERE host_user_id IS NOT NULL AND status IN ('open', 'matched');

CREATE INDEX IF NOT EXISTS duels_open_expiry_idx
ON public.duels(expires_at)
WHERE status = 'open';

CREATE OR REPLACE FUNCTION public.runnit_duel_lifecycle_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = 'pg_catalog', 'public'
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.host_user_id IS NULL OR NEW.status IS DISTINCT FROM 'open'
       OR NEW.challenger_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'New challenges must be open and owned by one host'
        USING ERRCODE = '23514';
    END IF;
    -- Browser-supplied timestamps cannot lengthen or backdate a lobby.
    NEW.created_at := statement_timestamp();
    NEW.expires_at := NEW.created_at + interval '60 minutes';
    NEW.matched_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'Challenge expiry is server-controlled'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'open' AND NEW.status = 'matched' THEN
      IF OLD.expires_at <= statement_timestamp()
         OR NEW.challenger_user_id IS NULL
         OR NEW.challenger_user_id IS NOT DISTINCT FROM NEW.host_user_id THEN
        RAISE EXCEPTION 'Challenge expired or opponent invalid'
          USING ERRCODE = '23514';
      END IF;
      NEW.matched_at := statement_timestamp();
    ELSIF OLD.status = 'open' AND NEW.status = 'expired' THEN
      IF OLD.expires_at > statement_timestamp() THEN
        RAISE EXCEPTION 'Challenge has not expired yet'
          USING ERRCODE = '23514';
      END IF;
    ELSIF OLD.status = 'open' AND NEW.status = 'cancelled' THEN
      -- The existing guard_duel_cancellation trigger protects ownership.
      NULL;
    ELSIF OLD.status = 'matched' AND NEW.status = 'completed' THEN
      IF OLD.challenger_user_id IS NULL OR OLD.start_at IS NULL
         OR NOT EXISTS (
           SELECT 1 FROM public.duel_results r
           WHERE r.duel_id = OLD.id AND r.user_id = OLD.host_user_id
         )
         OR NOT EXISTS (
           SELECT 1 FROM public.duel_results r
           WHERE r.duel_id = OLD.id AND r.user_id = OLD.challenger_user_id
         ) THEN
        RAISE EXCEPTION 'Both participants must finish before completing'
          USING ERRCODE = '23514';
      END IF;
    ELSIF OLD.status = 'matched' AND NEW.status = 'abandoned' THEN
      IF NOT (
        (OLD.start_at IS NULL
         AND OLD.matched_at <= statement_timestamp() - interval '30 minutes')
        OR (OLD.start_at IS NOT NULL
            AND OLD.start_at <= statement_timestamp() - interval '4 hours')
      ) THEN
        RAISE EXCEPTION 'Matched challenge is not abandoned yet'
          USING ERRCODE = '23514';
      END IF;
    ELSE
      RAISE EXCEPTION 'Forbidden challenge lifecycle transition'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.matched_at IS DISTINCT FROM OLD.matched_at THEN
    RAISE EXCEPTION 'Match timestamp is server-controlled'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS runnit_duel_lifecycle_guard ON public.duels;
CREATE TRIGGER runnit_duel_lifecycle_guard
  BEFORE INSERT OR UPDATE ON public.duels
  FOR EACH ROW EXECUTE FUNCTION public.runnit_duel_lifecycle_guard();

-- The nearby RPC excludes stale lobbies even if the scheduler runs late.
CREATE OR REPLACE FUNCTION public.get_duels_nearby(
  lat double precision, lng double precision, radius_km double precision
) RETURNS SETOF public.duels
LANGUAGE sql STABLE
SET search_path TO 'pg_catalog', 'public'
AS $fn$
  SELECT * FROM public.duels
  WHERE status = 'open'
    AND expires_at > now()
    AND ST_DWithin(location, ST_MakePoint(lng, lat)::geography, radius_km * 1000)
  ORDER BY created_at DESC;
$fn$;

-- join_duel is an EXISTING SECURITY DEFINER RPC: keep its role privileges,
-- validate JWT identity and enforce expiry while the lobby row is locked.
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

-- The existing result RPC is SECURITY DEFINER. Mark matched as completed
-- only once both authenticated participants have submitted a finish result.
-- A completed race frees the unique host slot; 60-minute lobby TTL never
-- interrupts an already matched or actively running race.
CREATE OR REPLACE FUNCTION public.submit_duel_result(
  p_duel_id uuid, p_time_ms integer,
  p_steps_count integer DEFAULT NULL,
  p_step_length_m_avg double precision DEFAULT NULL,
  p_max_speed_mps double precision DEFAULT NULL,
  p_max_accel_mps2 double precision DEFAULT NULL,
  p_distance_m double precision DEFAULT NULL,
  p_metrics_json jsonb DEFAULT NULL
) RETURNS public.duel_results
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $fn$
DECLARE
  v_result public.duel_results;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.duels d
    WHERE d.id = p_duel_id AND d.status = 'matched'
      AND (d.host_user_id = auth.uid()
           OR d.challenger_user_id = auth.uid())
      AND d.start_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Not an active duel participant'
      USING ERRCODE = '42501';
  END IF;
  IF p_time_ms IS NULL OR p_time_ms <= 0 THEN
    RAISE EXCEPTION 'Invalid time' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.duel_results (
    duel_id, user_id, time_ms,
    steps_count, step_length_m_avg, max_speed_mps, max_accel_mps2,
    distance_m, metrics_json
  ) VALUES (
    p_duel_id, auth.uid(), p_time_ms,
    p_steps_count, p_step_length_m_avg, p_max_speed_mps,
    p_max_accel_mps2, p_distance_m, p_metrics_json
  ) RETURNING * INTO v_result;

  UPDATE public.duels d
  SET status = 'completed'
  WHERE d.id = p_duel_id AND d.status = 'matched'
    AND d.challenger_user_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.duel_results r
      WHERE r.duel_id = d.id AND r.user_id = d.host_user_id
    )
    AND EXISTS (
      SELECT 1 FROM public.duel_results r
      WHERE r.duel_id = d.id AND r.user_id = d.challenger_user_id
    );

  RETURN v_result;
END;
$fn$;
