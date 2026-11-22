import test from 'node:test';
import assert from 'node:assert/strict';
import { validWalkingGpsFixTimestamp } from '../src/lib/walkingGpsFix.ts';

const now = 1_800_000_000_000;

test('walking GPS includes exact freshness boundaries, rejects one millisecond beyond', () => {
  assert.equal(validWalkingGpsFixTimestamp(now - 3000, now, null), true);
  assert.equal(validWalkingGpsFixTimestamp(now - 3001, now, null), false);
  assert.equal(validWalkingGpsFixTimestamp(now + 1000, now, null), true);
  assert.equal(validWalkingGpsFixTimestamp(now + 1001, now, null), false);
});

test('walking GPS requires strictly increasing accepted epochs even on freshness boundaries', () => {
  assert.equal(validWalkingGpsFixTimestamp(now - 3000, now, now - 3001), true);
  assert.equal(validWalkingGpsFixTimestamp(now - 3000, now, now - 3000), false);
  assert.equal(validWalkingGpsFixTimestamp(now + 1000, now, now + 1000), false);
  assert.equal(validWalkingGpsFixTimestamp(now + 1000, now, now + 999), true);
});

test('walking GPS rejects non-finite clock and previous timestamps without interpreting monotonic milliseconds as epoch', () => {
  assert.equal(validWalkingGpsFixTimestamp(1234, now, null), false);
  assert.equal(validWalkingGpsFixTimestamp(now, Number.POSITIVE_INFINITY, null), false);
  assert.equal(validWalkingGpsFixTimestamp(now, now, Number.POSITIVE_INFINITY), false);
  assert.equal(validWalkingGpsFixTimestamp(now, now, Number.NaN), false);
});
