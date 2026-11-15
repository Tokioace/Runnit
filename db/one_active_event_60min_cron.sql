-- Supabase Cron: retire stale open events every minute.
-- The separate matched grace periods ensure a 60-minute wait timer never
-- aborts a race that has already accepted a second player.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE OR REPLACE FUNCTION public.runnit_close_stale_duels()
RETURNS void LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $fn$
BEGIN
  UPDATE public.duels
  SET status = 'expired'
  WHERE status = 'open' AND expires_at <= now();

  -- Safety valve for users who matched but never started the race: 30 min.
  -- Once the race has started, allow 4 hours for both finish results.
  UPDATE public.duels
  SET status = 'abandoned'
  WHERE status = 'matched'
    AND (
      (start_at IS NULL AND matched_at <= now() - interval '30 minutes')
      OR
      (start_at IS NOT NULL AND start_at <= now() - interval '4 hours')
    );
END;
$fn$;

REVOKE ALL ON FUNCTION public.runnit_close_stale_duels() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.runnit_close_stale_duels() FROM anon;
REVOKE ALL ON FUNCTION public.runnit_close_stale_duels() FROM authenticated;

-- Idempotent by name; one single lightweight SQL job, no Vercel builds.
SELECT cron.schedule(
  'runnit-expire-open-and-abandoned-duels',
  '* * * * *',
  'SELECT public.runnit_close_stale_duels();'
);
