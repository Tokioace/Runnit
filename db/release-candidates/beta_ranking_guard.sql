-- RELEASE CANDIDATE ONLY. Not an active migration.
-- Plausibility filters for existing opt-in Beta rankings, not verified records.
-- Both competitors must have plausible times. No result deletion or mutation.
-- Ignore client-supplied verification flags and motion diagnostics for eligibility.
-- Keep original RPC signatures and existing public opt-in access.

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
      AND d.target_distance_m IN (50,75,100)
      AND d.start_at IS NOT NULL
      AND host_r.created_at >= d.start_at
      AND guest_r.created_at >= d.start_at
      AND host_r.time_ms >= CEIL(d.target_distance_m * 1000.0 / 15)
      AND guest_r.time_ms >= CEIL(d.target_distance_m * 1000.0 / 15)
      AND host_r.time_ms <= EXTRACT(EPOCH FROM (host_r.created_at - d.start_at)) * 1000 + 2000
      AND guest_r.time_ms <= EXTRACT(EPOCH FROM (guest_r.created_at - d.start_at)) * 1000 + 2000
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


-- Historical LEGENDS visual concept, now calculated exclusively from paired,
-- completed real duels. Only explicitly opted-in players are visible.
-- No invented ratings, reaction times, records or regional data.
CREATE OR REPLACE FUNCTION public.list_beta_runnit_records(
  p_metric text DEFAULT 'times',
  p_distance_m integer DEFAULT 50,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  rank_position bigint,
  user_id uuid,
  username text,
  metric_value double precision,
  races_count integer,
  wins_count integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'pg_catalog'
AS $func$
BEGIN
  IF p_metric IS NULL OR p_metric NOT IN
       ('times', 'speed', 'acceleration', 'wins', 'streak', 'duels') THEN
    RAISE EXCEPTION 'Invalid record metric' USING ERRCODE = '22023';
  END IF;
  IF p_distance_m IS NULL OR p_distance_m NOT IN (50, 75, 100) THEN
    RAISE EXCEPTION 'Invalid distance' USING ERRCODE = '22023';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid limit' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH race_rows AS (
    SELECT d.id AS duel_id,
           d.created_at AS played_at,
           d.target_distance_m AS race_distance,
           own.user_id AS player_id,
           own.time_ms,
           own.max_speed_mps,
           own.max_accel_mps2,
           CASE WHEN own.time_ms < rival.time_ms THEN 1 ELSE 0 END AS win
    FROM public.duels d
    JOIN public.duel_results own
      ON own.duel_id = d.id
      AND own.user_id IN (d.host_user_id, d.challenger_user_id)
    JOIN public.duel_results rival
      ON rival.duel_id = d.id AND rival.user_id <> own.user_id
      AND rival.user_id IN (d.host_user_id, d.challenger_user_id)
    WHERE d.status = 'completed'
      AND d.host_user_id IS NOT NULL
      AND d.challenger_user_id IS NOT NULL
      AND d.host_user_id <> d.challenger_user_id
      AND d.target_distance_m IN (50,75,100)
      AND d.start_at IS NOT NULL
      AND own.created_at >= d.start_at
      AND rival.created_at >= d.start_at
      AND own.time_ms >= CEIL(d.target_distance_m * 1000.0 / 15)
      AND rival.time_ms >= CEIL(d.target_distance_m * 1000.0 / 15)
      AND own.time_ms <= EXTRACT(EPOCH FROM (own.created_at - d.start_at)) * 1000 + 2000
      AND rival.time_ms <= EXTRACT(EPOCH FROM (rival.created_at - d.start_at)) * 1000 + 2000
      AND (SELECT COUNT(*) FROM public.duel_results total
           WHERE total.duel_id = d.id) = 2
  ),
  grouped AS (
    SELECT r.player_id, r.win,
           SUM(CASE WHEN r.win = 0 THEN 1 ELSE 0 END) OVER (
             PARTITION BY r.player_id
             ORDER BY r.played_at, r.duel_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) AS broken_streaks
    FROM race_rows r
  ),
  streaks AS (
    SELECT player_id, MAX(run_length)::integer AS best_streak
    FROM (
      SELECT player_id, broken_streaks, COUNT(*) AS run_length
      FROM grouped WHERE win = 1
      GROUP BY player_id, broken_streaks
    ) measured
    GROUP BY player_id
  ),
  scores AS (
    SELECT r.player_id,
           COUNT(*)::integer AS races,
           SUM(r.win)::integer AS wins,
           MIN(r.time_ms) FILTER (WHERE r.race_distance = p_distance_m)::double precision AS fastest,
           MAX(r.max_speed_mps) FILTER (
              WHERE r.max_speed_mps > 0
                AND r.max_speed_mps <= 15
           ) AS speed,
           MAX(r.max_accel_mps2) FILTER (
              WHERE r.max_accel_mps2 > 0
                AND r.max_accel_mps2 <= 60
           ) AS acceleration
    FROM race_rows r
    GROUP BY r.player_id
  ),
  visible AS (
    SELECT s.player_id, s.races, s.wins,
           COALESCE(st.best_streak, 0) AS best_streak,
           COALESCE(NULLIF(BTRIM(u.username), ''), 'Runner')::text AS nickname,
           CASE p_metric
             WHEN 'times' THEN s.fastest
             WHEN 'speed' THEN s.speed
             WHEN 'acceleration' THEN s.acceleration
             WHEN 'wins' THEN s.wins::double precision
             WHEN 'streak' THEN COALESCE(st.best_streak, 0)::double precision
             WHEN 'duels' THEN s.races::double precision
           END AS score
    FROM scores s
    JOIN public.users u ON u.id = s.player_id
    LEFT JOIN streaks st ON st.player_id = s.player_id
    WHERE u.leaderboard_opt_in IS TRUE
  )
  SELECT ROW_NUMBER() OVER (
           ORDER BY
             CASE WHEN p_metric = 'times' THEN v.score ELSE NULL END ASC NULLS LAST,
             CASE WHEN p_metric <> 'times' THEN v.score ELSE NULL END DESC NULLS LAST,
             v.races DESC, v.nickname ASC, v.player_id ASC
         )::bigint,
         v.player_id, v.nickname, v.score, v.races, v.wins
  FROM visible v
  WHERE v.score IS NOT NULL
  ORDER BY 1
  LIMIT p_limit;
END;
$func$;

REVOKE ALL ON FUNCTION public.list_beta_runnit_records(text,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_beta_runnit_records(text,integer,integer)
  TO anon, authenticated;
