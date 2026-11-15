import test from 'node:test';
import assert from 'node:assert/strict';
import { validWalkingGpsFixTimestamp } from '../src/lib/walkingGpsFix.ts';

const now = 1_800_000_000_000;

test('walking GPS accepts fresh epoch fix and increasing timestamps', () => {
  assert.equal(validWalkingGpsFixTimestamp(now - 100, now, null), true);
  assert.equal(validWalkingGpsFixTimestamp(now - 50, now, now - 100), true);
});

test('walking GPS rejects stale, future, repeated and out-of-order fixes', () => {
  assert.equal(validWalkingGpsFixTimestamp(now - 3001, now, null), false);
  assert.equal(validWalkingGpsFixTimestamp(now + 1001, now, null), false);
  assert.equal(validWalkingGpsFixTimestamp(now - 100, now, now - 100), false);
  assert.equal(validWalkingGpsFixTimestamp(now - 200, now, now - 100), false);
});

test('walking GPS rejects invalid clock inputs', () => {
  for (const bad of [NaN, Infinity, -Infinity, 0, -1]) {
    assert.equal(validWalkingGpsFixTimestamp(bad, now, null), false);
  }
  assert.equal(validWalkingGpsFixTimestamp(now, NaN, null), false);
});
