import test from 'node:test';
import assert from 'node:assert/strict';
import { determineDuelOutcome } from '../src/lib/duelOutcome.ts';

const host = '20e00385-9812-4666-9bca-3586f78fa711';
const guest = '20e00385-9812-4666-9bca-3586f78fa712';

// A database query without ORDER BY may return either participant first.
test('both devices receive complementary outcomes regardless of server row order', () => {
  for (const [hostMs, guestMs, hostOutcome, guestOutcome] of [
    [12_001, 12_002, 'won', 'lost'],
    [12_002, 12_001, 'lost', 'won'],
    [12_001, 12_001, 'tie', 'tie'],
  ]) {
    const rows = [{ user_id: host, time_ms: hostMs }, { user_id: guest, time_ms: guestMs }];
    for (const ordered of [rows, [...rows].reverse()]) {
      assert.equal(determineDuelOutcome(ordered, host, 'completed'), hostOutcome);
      assert.equal(determineDuelOutcome(ordered, guest, 'completed'), guestOutcome);
    }
  }
});

test('a third result row must not award a winner even when two valid times exist', () => {
  const rows = [
    { user_id: host, time_ms: 12_001 },
    { user_id: guest, time_ms: 12_002 },
    { user_id: '20e00385-9812-4666-9bca-3586f78fa713', time_ms: 12_003 },
  ];
  assert.equal(determineDuelOutcome(rows, host, 'completed'), 'pending');
  assert.equal(determineDuelOutcome(rows, guest, 'completed'), 'pending');
});
