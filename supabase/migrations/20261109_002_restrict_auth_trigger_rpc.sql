-- A trigger function is executed internally by PostgreSQL, not via RPC.
-- Remove the obsolete public direct-call grant from authenticated clients.
-- No stored data or trigger registration is changed.
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM authenticated;
