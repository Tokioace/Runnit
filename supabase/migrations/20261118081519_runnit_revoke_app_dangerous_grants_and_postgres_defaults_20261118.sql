-- Already applied to Runnit Supabase as version 20261118081519.
-- Make app-owned tables least-privileged while retaining standard CRUD/RLS.
-- TRUNCATE bypasses RLS, while TRIGGER/REFERENCES/MAINTAIN are unnecessary
-- for authenticated browser clients.
REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN
  ON TABLE public.users, public.duels, public.duel_results,
           public.ghost_runs, public.ghost_run_sessions
  FROM authenticated, anon;

-- Future objects created by postgres should not auto-grant those powers.
-- Supabase-owned PostGIS/extension default privileges are separately owned.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLES FROM authenticated, anon;

DO $$
BEGIN
  IF has_table_privilege('authenticated','public.users','TRUNCATE')
     OR has_table_privilege('authenticated','public.duels','TRUNCATE')
     OR has_table_privilege('authenticated','public.ghost_runs','TRUNCATE')
     OR has_table_privilege('authenticated','public.users','TRIGGER')
     OR NOT has_table_privilege('authenticated','public.duels','SELECT')
     OR NOT has_column_privilege('authenticated','public.users','username','SELECT')
  THEN
    RAISE EXCEPTION 'Runnit app privilege hardening assertion failed';
  END IF;
END
$$;
