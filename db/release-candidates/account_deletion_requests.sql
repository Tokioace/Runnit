-- RELEASE CANDIDATE ONLY. Do not activate until a real operator workflow
-- for completing deletion and sending confirmation has been tested.
CREATE TABLE public.account_deletion_requests (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_deletion_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id, requested_at), INSERT (user_id)
  ON TABLE public.account_deletion_requests TO authenticated;
CREATE POLICY deletion_request_read_own ON public.account_deletion_requests
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY deletion_request_insert_own ON public.account_deletion_requests
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
-- No client UPDATE or DELETE. No privileged deletion RPC. An operator must
-- fulfill the request after verifying identity and all associated data.
