-- Runnit: terminate matched races explicitly before Ready, during countdown or mid-run.
-- Keep the existing cron abandonment window and preserve host-only open cancellations.
-- The participant-authenticated RPC atomically releases the one-active-host lock.
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
      -- A participant can explicitly abandon the matched duel at any time.
      -- The periodic expiry job still has its original 30m/4h timeouts.
      -- No other columns may be altered in either path.
      IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
        RAISE EXCEPTION 'Only duel status may change during abandonment'
          USING ERRCODE = '42501';
      END IF;
      IF NOT (
        (auth.uid() IS NOT NULL
          AND (OLD.host_user_id = auth.uid() OR OLD.challenger_user_id = auth.uid()))
        OR (OLD.start_at IS NULL
            AND OLD.matched_at <= statement_timestamp() - interval '30 minutes')
        OR (OLD.start_at IS NOT NULL
            AND OLD.start_at <= statement_timestamp() - interval '4 hours')
      ) THEN
        RAISE EXCEPTION 'Only a participant can abort a live matched duel'
          USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.abort_duel(p_duel_id uuid)
RETURNS public.duels
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $abort$
DECLARE
  v_duel public.duels;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
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
$abort$;

REVOKE ALL ON FUNCTION public.abort_duel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abort_duel(uuid) TO authenticated;
