import test from 'node:test';
import assert from 'node:assert/strict';
import { raceHistoryFromServer } from '../src/lib/runnerHistory.ts';

const own = [{ duel_id: 'duel-1', user_id: 'host', time_ms: 9000,
  steps_count: 20, distance_m: 50, created_at: '2026-11-19T12:00:00Z' }];
const duel = { id: 'duel-1', status: 'completed', target_distance_m: 50,
  host_user_id: 'host', challenger_user_id: 'guest',
  created_at: '2026-11-19T11:00:00Z' };
const evaluate = (duelRow, paired) => raceHistoryFromServer(
  'host', own, [duelRow], new Map([['duel-1', paired]])
)[0];

test('a valid two-person result remains completed with correct winner', () => {
  const result = evaluate(duel, [
    { user_id: 'host', time_ms: 9000 },
    { user_id: 'guest', time_ms: 11000 },
  ]);
  assert.equal(result.completed, true);
  assert.equal(result.outcome, 'won');
});

test('duplicate paired identities never produce a completed result', () => {
  const result = evaluate(duel, [
    { user_id: 'host', time_ms: 9000 },
    { user_id: 'host', time_ms: 11000 },
  ]);
  assert.equal(result.completed, false);
  assert.equal(result.outcome, 'pending');
});

test('a malformed duel with identical host and challenger stays pending', () => {
  const result = evaluate({ ...duel, challenger_user_id: 'host' }, [
    { user_id: 'host', time_ms: 9000 },
    { user_id: 'outsider', time_ms: 11000 },
  ]);
  assert.equal(result.completed, false);
  assert.equal(result.outcome, 'pending');
});

test('foreign paired identities cannot influence a result', () => {
  const result = evaluate(duel, [
    { user_id: 'host', time_ms: 9000 },
    { user_id: 'outsider', time_ms: 11000 },
  ]);
  assert.equal(result.completed, false);
  assert.equal(result.outcome, 'pending');
});

test('malformed paired rows leave the own result pending instead of throwing', () => {
  const valid = {user_id:'host',time_ms:9000};
  for (const bad of [null, undefined, {}, 'guest', [], {user_id:42,time_ms:11000}, {user_id:' ',time_ms:11000}, {user_id:'guest',time_ms:NaN}]) {
    const result = evaluate(duel,[valid,bad]);
    assert.equal(result.completed,false);
    assert.equal(result.outcome,'pending');
    assert.equal(result.opponentName,null);
    assert.equal(result.timeMs,9000);
  }
});
test('optional opponent name cannot break a valid paired result', () => {
  for (const username of [null,undefined,42,{},[], '   ']) {
    const result = evaluate(duel,[{user_id:'host',time_ms:9000},{user_id:'guest',time_ms:11000,username}]);
    assert.equal(result.completed,true);
    assert.equal(result.outcome,'won');
    assert.equal(result.opponentName,null);
  }
  assert.equal(evaluate(duel,[{user_id:'host',time_ms:9000},{user_id:'guest',time_ms:11000,username:'  Runner  '}]).opponentName,'Runner');
});
