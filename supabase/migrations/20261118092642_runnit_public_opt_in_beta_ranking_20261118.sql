-- Make the voluntary public Beta ranking browseable in guest mode.
-- The function exposes ONLY players whose leaderboard_opt_in is TRUE.
CREATE OR REPLACE FUNCTION public.list_beta_duel_leaderboard(
  p_target_distance_m integer DEFAULT 50,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  rank_position bigint,
  user_id uuid,
  username text,
  best_time_ms integer,
  races_count integer,
  wins_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'pg_catalog'
AS $function$
BEGIN
  IF p_target_distance_m IS NOT NULL
      AND p_target_distance_m NOT IN (50,75,100) THEN
    RAISE EXCEPTION 'Invalid ranking distance' USING ERRCODE='22023';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid ranking limit' USING ERRCODE='22023';
  END IF;

  RETURN QUERY
  WITH paired AS (
    SELECT d.id
    FROM public.duels AS d
    JOIN public.duel_results AS host_r
      ON host_r.duel_id=d.id AND host_r.user_id=d.host_user_id
    JOIN public.duel_results AS guest_r
      ON guest_r.duel_id=d.id AND guest_r.user_id=d.challenger_user_id
    WHERE d.status='completed'
      AND d.host_user_id IS NOT NULL AND d.challenger_user_id IS NOT NULL
      AND d.host_user_id<>d.challenger_user_id
      AND host_r.time_ms>0 AND guest_r.time_ms>0
      AND (p_target_distance_m IS NULL OR d.target_distance_m=p_target_distance_m)
      AND (SELECT count(*) FROM public.duel_results all_r WHERE all_r.duel_id=d.id)=2
  ),
  performances AS (
    SELECT own.user_id,own.duel_id,own.time_ms,
           CASE WHEN own.time_ms<other.time_ms THEN 1 ELSE 0 END AS win
    FROM paired p
    JOIN public.duel_results own ON own.duel_id=p.id
    JOIN public.duel_results other ON other.duel_id=p.id AND other.user_id<>own.user_id
  ),
  scores AS (
    SELECT u.id AS player_id, COALESCE(NULLIF(BTRIM(u.username),''),'Runner')::text AS name,
           MIN(p.time_ms)::integer AS fastest,
           COUNT(*)::integer AS race_total, SUM(p.win)::integer AS win_total
    FROM performances p JOIN public.users u ON u.id=p.user_id
    WHERE u.leaderboard_opt_in IS TRUE
    GROUP BY u.id,u.username
  )
  SELECT ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN p_target_distance_m IS NULL THEN s.win_total ELSE NULL END DESC NULLS LAST,
        CASE WHEN p_target_distance_m IS NOT NULL THEN s.fastest ELSE NULL END ASC NULLS LAST,
        s.race_total DESC, s.name ASC, s.player_id ASC
      )::bigint AS rank_position,
      s.player_id AS user_id, s.name AS username,
      CASE WHEN p_target_distance_m IS NULL THEN NULL ELSE s.fastest END AS best_time_ms,
      s.race_total AS races_count,s.win_total AS wins_count
  FROM scores s
  ORDER BY 1
  LIMIT p_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_beta_duel_leaderboard(integer,integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_beta_duel_leaderboard(integer,integer)
  TO authenticated, anon;

