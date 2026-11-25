-- RELEASE CANDIDATE ONLY. Not an active Supabase migration.
-- Link the app profile to its auth identity. Do not silently remove orphan rows.
-- In production validate orphan count and review locks before installation.
ALTER TABLE public.users ADD CONSTRAINT runnit_profile_auth_identity_fk
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Only the trusted authentication/admin deletion path should remove profiles.
REVOKE DELETE ON TABLE public.users FROM PUBLIC, anon, authenticated;

CREATE SCHEMA IF NOT EXISTS runnit_private;
REVOKE ALL ON SCHEMA runnit_private FROM PUBLIC, anon, authenticated;

-- Fail closed on shared races until an approved anonymization/retention
-- policy exists. This prevents an Auth deletion from silently cascading
-- into another runner's result or stranding their active match.
CREATE OR REPLACE FUNCTION runnit_private.guard_profile_erasure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog'
AS $guard$
BEGIN
  -- Serialize against join/ready/finish operations on affected duels.
  PERFORM d.id FROM public.duels d
   WHERE d.host_user_id=OLD.id OR d.challenger_user_id=OLD.id
   ORDER BY d.id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.duels d
    WHERE (d.host_user_id=OLD.id OR d.challenger_user_id=OLD.id)
      AND (
        (d.host_user_id IS NOT NULL AND d.host_user_id<>OLD.id)
        OR (d.challenger_user_id IS NOT NULL AND d.challenger_user_id<>OLD.id)
        OR EXISTS (SELECT 1 FROM public.duel_results r
                   WHERE r.duel_id=d.id AND r.user_id IS DISTINCT FROM OLD.id)
      )
  ) THEN
    RAISE EXCEPTION 'Shared race data requires reviewed erasure handling'
      USING ERRCODE='23514';
  END IF;
  RETURN OLD;
END;
$guard$;
REVOKE ALL ON FUNCTION runnit_private.guard_profile_erasure()
  FROM PUBLIC, anon, authenticated;
CREATE TRIGGER runnit_guard_profile_erasure BEFORE DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION runnit_private.guard_profile_erasure();
