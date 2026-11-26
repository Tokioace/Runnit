import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abortMatchedDuel } from '../src/db/abortMatchedDuel.ts';

const duel = 'a9327ea6-733e-4f3d-a8e2-64ad5da281cd';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('aborting a duel requires confirmed matching server result', async () => {
  const seen = [];
  const client = { rpc: async (name, params) => {
    seen.push({ name, params });
    return { data: { id: duel, status: 'abandoned' }, error: null };
  }};
  assert.deepEqual(await abortMatchedDuel(client, duel), { id: duel, status: 'abandoned' });
  assert.deepEqual(seen, [{ name: 'abort_duel', params: { p_duel_id: duel } }]);
});

test('no optimistic local success from RPC errors or mismatched rows', async () => {
  for (const result of [
    { data: null, error: { code: '42501', message: 'Not a participant' } },
    { data: { id: duel, status: 'matched' }, error: null },
    { data: { id: 'another', status: 'abandoned' }, error: null },
    { data: null, error: null },
  ]) {
    await assert.rejects(abortMatchedDuel({ rpc: async () => result }, duel));
  }
});

test('invalid duel IDs never reach Supabase', async () => {
  await assert.rejects(abortMatchedDuel({ rpc: () => { throw Error('called'); } }, 'demo-run-42'), /Ungültige Renn-ID/);
});

test('server abort RPC is authenticated, checks participants and is idempotent', () => {
  const sql = read('supabase/migrations/20261116_004_abort_matched_duel.sql');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public.abort_duel\(p_duel_id uuid\)/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path TO 'pg_catalog', 'public'/);
  assert.match(sql, /v_actor IS NULL/);
  assert.match(sql, /v_actor IS DISTINCT FROM v_duel.host_user_id/);
  assert.match(sql, /v_actor IS DISTINCT FROM v_duel.challenger_user_id/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /IF v_duel.status = 'abandoned' THEN/);
  assert.match(sql, /UPDATE public.duels SET status = 'abandoned'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public.abort_duel\(uuid\) FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public.abort_duel\(uuid\) TO authenticated/);
  assert.doesNotMatch(sql, /DELETE FROM public.duels/);
});

test('lifecycle trigger keeps old timeout while allowing only participants to abort', () => {
  for (const path of ['supabase/migrations/20261116_004_abort_matched_duel.sql', 'db/one_active_event_60min_lifecycle.sql']) {
    const sql = read(path);
    assert.match(sql, /OLD.status = 'matched' AND NEW.status = 'abandoned'/);
    assert.match(sql, /OLD.host_user_id = auth.uid\(\) OR OLD.challenger_user_id = auth.uid\(\)/);
    assert.match(sql, /OLD.matched_at <= statement_timestamp\(\) - interval '30 minutes'/);
    assert.match(sql, /OLD.start_at <= statement_timestamp\(\) - interval '4 hours'/);
    assert.match(sql, /\(to_jsonb\(NEW\) - 'status'\) IS DISTINCT FROM \(to_jsonb\(OLD\) - 'status'\)/);
    assert.match(sql, /OLD.status = 'open' AND NEW.status = 'cancelled'/);
  }
});

test('all three UIs confirm and use the shared server abort; no local-only termination', () => {
  const map = read('src/screens/MapScreen.tsx');
  const lobby = read('src/components/race/ReadyLobby.tsx');
  const countdown = read('src/components/race/RaceCountdown.tsx');
  assert.match(map, /const confirmAbortMatchedDuel = async \(duelId: string\) =>/);
  assert.match(map, /await abortMatchedDuel\(supabase, duelId\)/);
  assert.match(map, /clearAbortedDuel\(duelId, false\)/);
  assert.match(map, /onAbort=\{\(\) => confirmAbortMatchedDuel\(matchedDuel.id\)\}/);
  assert.match(map, /onAbort=\{\(\) => confirmAbortMatchedDuel\(matchOverlay.duelId\)\}/);
  assert.match(map, /onAbort=\{\(\) => confirmAbortMatchedDuel\(race.duelId\)\}/);
  assert.match(lobby, /JA, DUELL ABBRECHEN/);
  assert.match(countdown, /JA, ABBRECHEN/);
  assert.match(map, /JA, FÜR BEIDE ABBRECHEN/);
  assert.doesNotMatch(map, /onFinish\(Date.now\(\), \{[\s\S]*?\}, false\)/);
});

test('terminal event clears running screen, lobby and old reopen pill on both phones', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /const \[initialActiveDuelId\] = useState\(\(\) => authUser \? readActiveDuelId\(authUser.id\) : null\);/);
  assert.match(map, /const activeDuelIdRef = useRef<string \| null>\(initialActiveDuelId\)/);
  const clear = map.slice(map.indexOf('const clearAbortedDuel ='), map.indexOf('const showCompletedDuel ='));
  assert.match(clear, /activeDuelIdRef.current !== duelId\) return;/);
  assert.match(clear, /endedDuelIdsRef.current.add\(duelId\);\s*activeDuelIdRef.current = null;/);
  assert.match(map, /const endedDuelIdsRef = useRef<Set<string>>\(new Set\(\)\)/);
  assert.match(map, /endedDuelIdsRef.current.has\(row.id\)/);
  assert.match(map, /const clearAbortedDuel = React.useCallback/);
  assert.match(map, /setMatchOverlay\(previous => previous\?\.duelId === duelId \? null : previous\)/);
  assert.match(map, /setMatchedDuel\(previous => previous\?\.id === duelId \? null : previous\)/);
  assert.match(map, /setRace\(previous => previous.status !== 'idle' && previous.duelId === duelId/);
  assert.match(map, /setDismissedMatchId\(null\)/);
  assert.match(map, /setDiscoveryRefreshTick\(tick => tick \+ 1\)/);
  assert.match(map, /if \(payload.eventType === 'UPDATE' && row.status === 'abandoned'\)/);
  assert.match(map, /const activeId = activeDuelIdRef.current/);
  assert.match(map, /if \(latest\?\.status === 'abandoned'\)/);
});
