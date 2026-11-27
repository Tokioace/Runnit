import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDuelReadiness, readyRequestView } from '../src/lib/duelReadiness.ts';
import { createDuelStartLatch, isDuelStartRecoverable } from '../src/lib/duelStartLatch.ts';

test('two independent clients converge despite reversed Ready delivery and stale lobby snapshots', () => {
  const base = { id: 'duel', hostUserId: 'host', challengerUserId: 'rival', hostReady: false, challengerReady: false };
  const host = { ...base, hostReady: true };
  const rival = { ...base, challengerReady: true };
  const clients = [[host, rival, base], [rival, base, host]].map(messages =>
    messages.reduce((previous, incoming) => mergeDuelReadiness(previous, incoming), null));
  assert.deepEqual(clients[0], clients[1]);
  assert.equal(clients[0].hostReady, true);
  assert.equal(clients[1].challengerReady, true);
  for (const [i, client] of clients.entries()) {
    const ownReady = i === 0 ? client.hostReady : client.challengerReady;
    assert.deepEqual(readyRequestView(client.id, ownReady, client.id,
      { duelId: client.id, message: 'late timeout' }), { busy: false, error: null });
  }
});

test('independent countdown latches reject delayed null and conflicting starts, with explicit clock cutoff', () => {
  const start = '2026-11-27T12:00:10Z';
  const stamp = Date.parse(start);
  const clients = [createDuelStartLatch(), createDuelStartLatch()];
  assert.equal(clients[0].accept('duel', null), true);
  for (const client of clients) {
    assert.equal(client.accept('duel', start), true);
    assert.equal(client.accept('duel', null), false);
    assert.equal(client.accept('duel', '2026-11-27T12:00:11Z'), false);
    assert.equal(client.accept('duel', '2026-11-27T13:00:10+01:00'), true);
    assert.equal(client.accept('next-duel', null), true);
  }
  assert.equal(isDuelStartRecoverable(stamp, stamp + 9999), true);
  assert.equal(isDuelStartRecoverable(stamp, stamp + 10000), false);
});
