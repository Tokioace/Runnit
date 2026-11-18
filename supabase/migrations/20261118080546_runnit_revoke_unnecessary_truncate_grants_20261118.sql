-- Already applied to live Supabase as migration 20261118080546.
-- TRUNCATE bypasses RLS, so API user roles must never have this privilege.
-- Client SELECT/INSERT/DELETE and the existing RLS policies remain unchanged.
REVOKE TRUNCATE ON TABLE public.duels, public.ghost_runs FROM authenticated;

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.duels','TRUNCATE')
     OR has_table_privilege('authenticated','public.ghost_runs','TRUNCATE') THEN
    RAISE EXCEPTION 'RUNNIT SECURITY: TRUNCATE privilege must remain revoked';
  END IF;
  IF NOT has_table_privilege('authenticated','public.duels','SELECT')
     OR NOT has_table_privilege('authenticated','public.ghost_runs','SELECT') THEN
    RAISE EXCEPTION 'RUNNIT SECURITY: required SELECT rights missing';
  END IF;
END
$$;
