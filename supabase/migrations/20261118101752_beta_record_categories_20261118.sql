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
      AND own.time_ms > 0 AND rival.time_ms > 0
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
                AND r.max_speed_mps < 'Infinity'::double precision
           ) AS speed,
           MAX(r.max_accel_mps2) FILTER (
              WHERE r.max_accel_mps2 > 0
                AND r.max_accel_mps2 < 'Infinity'::double precision
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
