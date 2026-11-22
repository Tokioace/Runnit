import test from 'node:test';
import assert from 'node:assert/strict';
import { openEventMsLeft, isOpenEventAvailable, openEventClockLabel } from '../src/lib/duelExpiry.ts';

const NOW = Date.parse('2026-11-20T12:00:00.000Z');

test('rejects timezone-free expiry instead of using the phone timezone', () => {
  assert.equal(openEventMsLeft('2026-11-20T12:01:00', NOW), 0);
  assert.equal(isOpenEventAvailable('2026-11-20T12:01:00', NOW), false);
  assert.equal(openEventClockLabel('2026-11-20T12:01:00', NOW), '00:00');
});

test('accepts UTC and explicit offset with identical instant', () => {
  assert.equal(openEventMsLeft('2026-11-20T12:01:00Z', NOW), 60_000);
  assert.equal(openEventMsLeft('2026-11-20T13:01:00+01:00', NOW), 60_000);
  assert.equal(openEventClockLabel('2026-11-20T12:01:00Z', NOW), '01:00');
});

test('invalid timestamp or expired lobby never becomes available', () => {
  assert.equal(isOpenEventAvailable('not-a-dateZ', NOW), false);
  assert.equal(isOpenEventAvailable('2026-11-20T12:00:00Z', NOW), false);
});
