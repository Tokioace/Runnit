import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const candidate = read('db/release-candidates/duel_result_guard.sql');
const previous = read('supabase/migrations/20261116_005_complete_duel_for_both_players.sql');
test('staged RPC keeps auth, lock, idempotency, completion and grants', () => {
  for (const marker of ['auth.uid()', 'FOR UPDATE', 'IF FOUND THEN RETURN v_result; END IF',
    "v_duel.status IS DISTINCT FROM 'matched'", "SET status='completed'",
    'FROM PUBLIC, anon;', 'TO authenticated;', 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE']) {
    assert.ok(previous.includes(marker)); assert.ok(candidate.includes(marker));
  }
  assert.ok(candidate.indexOf('IF FOUND THEN RETURN v_result; END IF') < candidate.indexOf('v_elapsed_ms :='));
});
test('staged server guard uses database-owned target and start time', () => {
  assert.match(candidate,/v_duel.target_distance_m NOT IN \(50,75,100\)/);
  assert.match(candidate,/statement_timestamp\(\) - v_duel.start_at/);
  assert.match(candidate,/p_time_ms < CEIL\(v_duel.target_distance_m \* 1000.0 \/ 15\)/);
  assert.match(candidate,/p_time_ms > v_elapsed_ms \+ 2000/);
});
test('staged diagnostics whitelist does not insert arbitrary JSON or claim verification', () => {
  assert.match(candidate,/jsonb_each\(p_metrics_json\)/);
  assert.match(candidate,/p_distance_m, v_diagnostics\s+\) RETURNING/);
  assert.doesNotMatch(candidate,/p_distance_m, p_metrics_json\s+\) RETURNING/);
  assert.match(candidate,/"verification":"unverified"/);
  assert.match(candidate,/p_max_speed_mps NOT BETWEEN 0 AND 15/);
});

test('staged duel creation grants exclude client-controlled clock and ready state', () => {
  assert.match(candidate,/REVOKE INSERT ON TABLE public.duels FROM PUBLIC, anon, authenticated/);
  assert.match(candidate,/GRANT INSERT \(host_user_id, location, max_distance_km, target_distance_m, status\)\s+ON TABLE public.duels TO authenticated/);
  assert.match(candidate,/challenger_user_id, target_distance_m, host_ready, challenger_ready, start_at/);
});
