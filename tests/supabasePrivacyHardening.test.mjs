import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/20261109_001_auth_privacy_hardening.sql', import.meta.url), 'utf8');

test('anonymous role cannot select from live sport or identity tables', () => {
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE[\s\S]*?public\.users, public\.ghost_runs, public\.duels, public\.duel_results[\s\S]*?FROM anon;/);
});

test('signed-in user directory only exposes ID and nickname', () => {
  assert.match(migration, /REVOKE SELECT ON TABLE public\.users FROM PUBLIC, authenticated;/);
  assert.match(migration, /GRANT SELECT \(id, username\) ON TABLE public\.users TO authenticated;/);
  assert.doesNotMatch(migration, /GRANT SELECT \([^)]+location[^)]+\) ON TABLE public\.users/i);
});

test('private ghost runs are limited to the runner except for narrow leaderboard RPC', () => {
  assert.match(migration, /CREATE POLICY "Read own ghost runs" ON public\.ghost_runs/);
  assert.match(migration, /USING \(user_id = \(SELECT auth\.uid\(\)\)\)/);
  assert.match(migration, /NULL::double precision AS user_lat/);
  assert.match(migration, /NULL::double precision AS user_lng/);
  assert.match(migration, /NULL::uuid AS user_id/);
});

test('only participants see finished duel details and raw metrics belong to their creator', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_duel_results/);
  assert.match(migration, /AND \(d\.host_user_id = auth\.uid\(\) OR d\.challenger_user_id = auth\.uid\(\)\)/);
  assert.match(migration, /CASE WHEN r\.user_id = auth\.uid\(\) THEN r\.metrics_json ELSE NULL::jsonb END/);
});

test('server submission is not open to third parties or spectators', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.submit_duel_result/);
  assert.match(migration, /AND d\.start_at IS NOT NULL/);
  assert.match(migration, /RAISE EXCEPTION 'Not an active duel participant'/);
});

test('public cannot execute sensitive application RPCs or auth trigger manually', () => {
  assert.match(migration, /REVOKE EXECUTE ON FUNCTION[\s\S]*?public\.join_duel\(uuid\)[\s\S]*?public\.submit_duel_result[\s\S]*?FROM PUBLIC, anon;/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*?TO authenticated;/);
  assert.match(migration, /public\.handle_new_auth_user\(\)/);
});

test('registration trigger no longer makes email prefixes a public username', () => {
  assert.doesNotMatch(migration, /split_part\(NEW\.email/);
  assert.match(migration, /NEW\.raw_user_meta_data ->> 'display_name'/);
  assert.match(migration, /COALESCE\(nickname, 'Runnit-Läufer'\)/);
});
