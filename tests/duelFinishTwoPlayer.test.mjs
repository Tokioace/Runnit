import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { determineDuelOutcome } from '../src/lib/duelOutcome.ts';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const host = '20e00385-9812-4666-9bca-3586f78fa711';
const challenger = '20e00385-9812-4666-9bca-3586f78fa712';

test('each participant sees own win/loss from the same two server times', () => {
  const rows = [{ user_id: host, time_ms: 9321 }, { user_id: challenger, time_ms: 10102 }];
  assert.equal(determineDuelOutcome(rows, host, 'completed'), 'won');
  assert.equal(determineDuelOutcome(rows, challenger, 'completed'), 'lost');
  const reordered = [rows[1], rows[0]];
  assert.equal(determineDuelOutcome(reordered, challenger, 'completed'), 'lost');
  assert.equal(determineDuelOutcome(reordered, host, 'completed'), 'won');
});

test('ties, incomplete results, unknown users and non-completed duels are not declared winners', () => {
  const tie = [{ user_id: host, time_ms: 12000 }, { user_id: challenger, time_ms: 12000 }];
  assert.equal(determineDuelOutcome(tie, host, 'completed'), 'tie');
  assert.equal(determineDuelOutcome(tie, challenger, 'completed'), 'tie');
  assert.equal(determineDuelOutcome(tie, host, 'matched'), 'pending');
  assert.equal(determineDuelOutcome([tie[0]], host, 'completed'), 'pending');
  assert.equal(determineDuelOutcome([], host, 'completed'), 'pending');
  assert.equal(determineDuelOutcome([{ user_id: host, time_ms: 3 }, { user_id: host, time_ms: 4 }], host, 'completed'), 'pending');
  assert.equal(determineDuelOutcome([{ user_id: host, time_ms: -1 }, tie[1]], host, 'completed'), 'pending');
  assert.equal(determineDuelOutcome(tie, 'an-outsider', 'completed'), 'pending');
});

test('duel result screen fetches authoritative status/results on both devices and waits before dismissing', () => {
  const finish = read('src/components/race/DuelFinishScreen.tsx');
  assert.match(finish, /getDuelResults\(supabase, duelId\)/);
  assert.match(finish, /\.select\('id, status, host_user_id, challenger_user_id'\)/);
  assert.match(finish, /window\.setInterval\(\(\) =>/);
  assert.match(finish, /document\.addEventListener\('visibilitychange', onVisible\)/);
  assert.match(finish, /determineDuelOutcome\(uniqueResults, userId, status\)/);
  assert.match(finish, /outcome === 'won' \? 'DU GEWINNST!'/);
  assert.match(finish, /outcome === 'lost' \? 'DU VERLIERST!'/);
  assert.match(finish, /outcome === 'tie' \? 'UNENTSCHIEDEN!'/);
  assert.match(finish, /completed \? \(/);
  assert.match(finish, /onClick=\{onClose\}/);
  assert.match(finish, /DUELL ABBRECHEN, STATT ZU WARTEN/);
  assert.doesNotMatch(finish, /onAddToLeaderboard/);
});

test('completion is propagated via Realtime and recovery polling, then closing clears stale lobby', () => {
  const map = read('src/screens/MapScreen.tsx');
  assert.match(map, /const showCompletedDuel = React.useCallback/);
  assert.match(map, /const closeCompletedDuel = React.useCallback/);
  assert.match(map, /if \(payload.eventType === 'UPDATE' && row.status === 'completed'\)/);
  assert.match(map, /else if \(latest\?\.status === 'completed'\)/);
  assert.match(map, /showCompletedDuel\(row\)/);
  assert.match(map, /showCompletedDuel\(latest\)/);
  assert.match(map, /endedDuelIdsRef.current.add\(duelId\)/);
  assert.match(map, /activeDuelIdRef.current = null/);
  assert.match(map, /setMatchedDuel\(previous => previous\?\.id === duelId \? null : previous\)/);
  assert.match(map, /setDismissedMatchId\(null\)/);
  assert.match(map, /setRace\(previous => previous.status !== 'idle' && previous.duelId === duelId/);
  assert.match(map, /onClose=\{\(\) => closeCompletedDuel\(race.duelId\)\}/);
  assert.doesNotMatch(map, /function SideBySideResults/);
});

test('concurrent result submissions lock the duel, are idempotent and complete only with two runner results', () => {
  const sql = read('supabase/migrations/20261116_005_complete_duel_for_both_players.sql');
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS duel_results_one_per_runner_uidx/);
  assert.match(sql, /ON public.duel_results\(duel_id, user_id\)/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /SELECT \* INTO v_result FROM public.duel_results/);
  assert.match(sql, /IF FOUND THEN RETURN v_result; END IF/);
  assert.match(sql, /WHERE duel_id=p_duel_id AND user_id=v_duel.host_user_id/);
  assert.match(sql, /WHERE duel_id=p_duel_id AND user_id=v_duel.challenger_user_id/);
  assert.match(sql, /SET status='completed'/);
  assert.match(sql, /v_actor IS DISTINCT FROM v_duel.host_user_id/);
  assert.match(sql, /v_actor IS DISTINCT FROM v_duel.challenger_user_id/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public.submit_duel_result/);
  assert.match(sql, /TO authenticated/);
  assert.doesNotMatch(sql, /(?:^|\n)\s*(?:TRUNCATE\s+|DELETE FROM\s+public\.duel_results)/i);
});

test('failed finish submission has an explicit retry and does not score an unverified leaderboard win', () => {
  const map = read('src/screens/MapScreen.tsx');
  const finish = read('src/components/race/DuelFinishScreen.tsx');
  assert.match(map, /setFinishSubmissionError\('Zielzeit nicht gespeichert\. Bitte erneut versuchen\.'/);
  const retry = map.slice(map.indexOf('const retryFinishedTime ='), map.indexOf('const confirmAbortMatchedDuel ='));
  assert.match(retry, /const retryFinishedTime = async \(duelId: string\) =>/);
  assert.match(retry, /if \(payload\?\.duelId === duelId\) await sendFinishedTime\(payload\);/);
  assert.match(map, /onRetrySubmit=\{\(\) => retryFinishedTime\(race.duelId\)\}/);
  assert.match(finish, /ZIELZEIT ERNEUT SPEICHERN/);
  assert.match(finish, /nicht als verifizierte Ranglistenwertung/);
  assert.doesNotMatch(map, /source: 'local-unverified'/);
});
