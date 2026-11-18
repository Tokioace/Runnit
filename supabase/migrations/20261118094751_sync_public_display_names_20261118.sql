-- Align existing opt-in leaderboard nicknames with the authenticated profile.
-- Only copy valid-length, nonempty user-controlled display names. Idempotent.
-- Future edits performed within Runnit update both sources in useSupabaseUser.
UPDATE public.users AS p
SET username = BTRIM(a.raw_user_meta_data ->> 'display_name')
FROM auth.users AS a
WHERE p.id = a.id
  AND jsonb_typeof(a.raw_user_meta_data -> 'display_name') = 'string'
  AND char_length(BTRIM(a.raw_user_meta_data ->> 'display_name')) BETWEEN 3 AND 24
  AND p.username IS DISTINCT FROM BTRIM(a.raw_user_meta_data ->> 'display_name');
