-- Only in the ephemeral CI database after the lifecycle test.
BEGIN;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('00000000-0000-4000-8000-000000000011'),('00000000-0000-4000-8000-000000000012');
\ir account_deletion_requests.sql
SET LOCAL ROLE anon;
DO $test$
BEGIN
  BEGIN
    INSERT INTO public.account_deletion_requests(user_id) VALUES ('00000000-0000-4000-8000-000000000011');
    RAISE EXCEPTION 'anonymous request accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$test$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000011',true);
INSERT INTO public.account_deletion_requests(user_id) VALUES (auth.uid());
DO $test$
BEGIN
  IF (SELECT count(*) FROM public.account_deletion_requests) <> 1 THEN RAISE EXCEPTION 'own request not readable'; END IF;
  BEGIN
    INSERT INTO public.account_deletion_requests(user_id) VALUES (auth.uid());
    RAISE EXCEPTION 'duplicate accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.account_deletion_requests(user_id) VALUES ('00000000-0000-4000-8000-000000000012');
    RAISE EXCEPTION 'foreign request accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.account_deletion_requests SET requested_at=now()-interval '1 day';
    RAISE EXCEPTION 'client timestamp changed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.account_deletion_requests;
    RAISE EXCEPTION 'client deleted request';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$test$;
SELECT set_config('test.actor','00000000-0000-4000-8000-000000000012',true);
DO $test$
BEGIN
 IF EXISTS (SELECT 1 FROM public.account_deletion_requests) THEN RAISE EXCEPTION 'foreign request disclosed'; END IF;
END
$test$;
INSERT INTO public.account_deletion_requests(user_id) VALUES (auth.uid());
RESET ROLE;
DELETE FROM auth.users WHERE id='00000000-0000-4000-8000-000000000011';
DO $test$
BEGIN
 IF (SELECT count(*) FROM public.account_deletion_requests) <> 1 THEN RAISE EXCEPTION 'request did not cascade independently'; END IF;
END
$test$;
ROLLBACK;
