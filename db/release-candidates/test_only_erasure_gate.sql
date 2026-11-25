-- RELEASE CANDIDATE FOR DISPOSABLE TEST PROJECT ONLY.
-- Install after all three account erasure candidates; not a live migration.
-- Read-only catalog gate, no Auth deletion capability.
CREATE OR REPLACE FUNCTION public.runnit_test_erasure_gate()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='pg_catalog'
AS $gate$
 SELECT EXISTS (
  SELECT 1 FROM pg_constraint c
  WHERE c.conrelid='public.users'::regclass AND c.confrelid='auth.users'::regclass
    AND c.conname='runnit_profile_auth_identity_fk' AND c.contype='f'
    AND c.confdeltype='c' AND c.convalidated
 ) AND EXISTS (
  SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE t.tgrelid='public.users'::regclass AND t.tgname='runnit_guard_profile_erasure'
    AND t.tgenabled IN ('O','A') AND NOT t.tgisinternal
    AND n.nspname='runnit_private' AND p.proname='guard_profile_erasure'
 ) AND to_regclass('public.account_deletion_requests') IS NOT NULL
   AND to_regclass('public.archived_personal_duel_times') IS NOT NULL
$gate$;
REVOKE ALL ON FUNCTION public.runnit_test_erasure_gate() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.runnit_test_erasure_gate() TO service_role;
-- Explicit least-privilege service-role access for test operator reads.
GRANT SELECT ON public.account_deletion_requests, public.archived_personal_duel_times TO service_role;
