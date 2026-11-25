-- RELEASE CANDIDATE ONLY; apply after account_erasure_guard.sql in a test database.
-- No opponent identity, original duel id, location, opponent time, outcome,
-- raw diagnostics or ranking authority are retained in the personal archive.
CREATE TABLE public.archived_personal_duel_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL,
  target_distance_m integer,
  time_ms integer NOT NULL CHECK (time_ms>0),
  steps_count integer,
  distance_m double precision
);
ALTER TABLE public.archived_personal_duel_times ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.archived_personal_duel_times FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.archived_personal_duel_times TO authenticated;
CREATE POLICY read_own_archived_times ON public.archived_personal_duel_times
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE INDEX archived_personal_duel_times_user_date_idx
  ON public.archived_personal_duel_times(user_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION runnit_private.guard_profile_erasure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'pg_catalog'
AS $guard$
DECLARE affected public.duels;
BEGIN
  FOR affected IN
    SELECT d.* FROM public.duels d
    WHERE d.host_user_id=OLD.id OR d.challenger_user_id=OLD.id
    ORDER BY d.id FOR UPDATE
  LOOP
    -- Fail closed on unexpected historical rows instead of destroying data.
    IF EXISTS (SELECT 1 FROM public.duel_results r WHERE r.duel_id=affected.id
          AND r.user_id IS DISTINCT FROM OLD.id
          AND (r.user_id IS NULL OR
            (r.user_id IS DISTINCT FROM affected.host_user_id AND
             r.user_id IS DISTINCT FROM affected.challenger_user_id) OR
            r.time_ms IS NULL OR r.time_ms<=0 OR
            coalesce(r.created_at, affected.created_at) IS NULL)) THEN
      RAISE EXCEPTION 'Shared race contains unexpected historical data' USING ERRCODE='23514';
    END IF;
    IF (affected.host_user_id IS NOT NULL AND affected.host_user_id<>OLD.id)
       OR (affected.challenger_user_id IS NOT NULL AND affected.challenger_user_id<>OLD.id) THEN
      IF affected.status IS NULL OR affected.status NOT IN ('completed','abandoned','cancelled','expired') THEN
        RAISE EXCEPTION 'Active shared race requires resolution before erasure' USING ERRCODE='23514';
      END IF;
      INSERT INTO public.archived_personal_duel_times
        (user_id, occurred_at, target_distance_m, time_ms, steps_count, distance_m)
      SELECT r.user_id, coalesce(r.created_at,affected.created_at),
        affected.target_distance_m, r.time_ms, r.steps_count, r.distance_m
      FROM public.duel_results r WHERE r.duel_id=affected.id AND r.user_id<>OLD.id;
      -- Delete the shared row and its results together, after preserving
      -- only the surviving participant's own result. Transactional rollback
      -- restores both the original race and archive on failure.
      DELETE FROM public.duels WHERE id=affected.id;
    END IF;
  END LOOP;
  RETURN OLD;
END;
$guard$;
REVOKE ALL ON FUNCTION runnit_private.guard_profile_erasure() FROM PUBLIC, anon, authenticated;
