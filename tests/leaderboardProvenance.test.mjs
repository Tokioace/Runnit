import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCE_LABELS, leaderboardSourceLabel, partitionLeaderboard,
} from '../src/lib/leaderboardProvenance.ts';

test('all known result sources have explicitly non-verified labels', () => {
  assert.deepEqual(Object.keys(SOURCE_LABELS).sort(), [
    'demo', 'local-unverified', 'server-unverified',
  ]);
  assert.equal(leaderboardSourceLabel('demo'), 'Demo · erfunden');
  assert.equal(leaderboardSourceLabel('server-unverified'), 'Gespeichert · ungeprüft');
  assert.equal(leaderboardSourceLabel('local-unverified'), 'Lokal · ungeprüft');
  for (const label of Object.values(SOURCE_LABELS)) {
    assert.doesNotMatch(label, /(?<!un)verifiziert|offiziell/i);
  }
});

test('examples are strictly separated from stored and local results', () => {
  const entries = Object.freeze([
    Object.freeze({ id: 'demo-1', source: 'demo', seconds: 9 }),
    Object.freeze({ id: 'db-1', source: 'server-unverified', seconds: 11 }),
    Object.freeze({ id: 'local', source: 'local-unverified', seconds: 8 }),
    Object.freeze({ id: 'demo-2', source: 'demo', seconds: 10 }),
    Object.freeze({ id: 'db-2', source: 'server-unverified', seconds: 12 }),
  ]);
  const grouped = partitionLeaderboard(entries);
  assert.deepEqual(grouped.stored.map(entry => entry.id), ['db-1', 'db-2']);
  assert.deepEqual(grouped.local.map(entry => entry.id), ['local']);
  assert.deepEqual(grouped.demo.map(entry => entry.id), ['demo-1', 'demo-2']);
  assert.deepEqual(entries.map(entry => entry.id), ['demo-1', 'db-1', 'local', 'demo-2', 'db-2']);
  assert.equal(grouped.stored[0], entries[1]);
});

test('an empty leaderboard cannot invent stored or verified rankings', () => {
  assert.deepEqual(partitionLeaderboard([]), { stored: [], local: [], demo: [] });
});

test('one type of source does not masquerade as another when sorting', () => {
  const entries = [
    { id: 'demo-fast', source: 'demo', seconds: 7.8 },
    { id: 'db-slow', source: 'server-unverified', seconds: 9.7 },
  ];
  const sections = partitionLeaderboard(entries);
  assert.deepEqual(sections.stored.map(e => e.id), ['db-slow']);
  assert.deepEqual(sections.demo.map(e => e.id), ['demo-fast']);
});
