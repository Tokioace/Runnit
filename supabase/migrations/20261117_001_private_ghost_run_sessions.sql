-- Solo Ghost Run / beta diagnostics: PRIVATE run summaries only.
-- Do not insert unverified runs into ghost_runs (that table feeds a leaderboard).
-- Raw accelerometer traces and relative GPS tracks are kept on the device
-- and may be exported explicitly by the runner as an anonymised JSON file.
CREATE TABLE IF NOT EXISTS public.ghost_run_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_distance_m integer NOT NULL CHECK (target_distance_m IN (50,75,100)),
  run_state text NOT NULL CHECK (run_state IN ('finished','stopped')),
  elapsed_ms integer CHECK (elapsed_ms IS NULL OR (elapsed_ms > 0 AND elapsed_ms <= 3600000)),
  observed_distance_m double precision NOT NULL CHECK (observed_distance_m >= 0 AND observed_distance_m < 10000),
  steps_count integer NOT NULL CHECK (steps_count >= 0 AND steps_count <= 100000),
  gps_accepted integer NOT NULL CHECK (gps_accepted >= 0 AND gps_accepted <= 100000),
  gps_rejected integer NOT NULL CHECK (gps_rejected >= 0 AND gps_rejected <= 100000),
  motion_samples integer NOT NULL CHECK (motion_samples >= 0 AND motion_samples <= 1000000),
  motion_gaps integer NOT NULL CHECK (motion_gaps >= 0 AND motion_gaps <= 100000),
  max_speed_mps double precision CHECK (max_speed_mps IS NULL OR (max_speed_mps >= 0 AND max_speed_mps <= 50)),
  motion_permission text NOT NULL CHECK (motion_permission IN ('granted','denied','unavailable')),
  interrupted boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'ios-web-beta' CHECK (source = 'ios-web-beta'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ghost_run_sessions_owner_recent_idx
ON public.ghost_run_sessions(user_id,created_at DESC);
ALTER TABLE public.ghost_run_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ghost_run_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.ghost_run_sessions TO authenticated;
DROP POLICY IF EXISTS ghost_run_sessions_read_own ON public.ghost_run_sessions;
CREATE POLICY ghost_run_sessions_read_own ON public.ghost_run_sessions
FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS ghost_run_sessions_insert_own ON public.ghost_run_sessions;
CREATE POLICY ghost_run_sessions_insert_own ON public.ghost_run_sessions
FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS ghost_run_sessions_delete_own ON public.ghost_run_sessions;
CREATE POLICY ghost_run_sessions_delete_own ON public.ghost_run_sessions
FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
