import test from 'node:test';
import assert from 'node:assert/strict';
import {
  openEventMsLeft,
  isOpenEventAvailable,
  openEventClockLabel,
} from '../src/lib/duelExpiry.ts';

const expiresAt = '2026-11-17T09:01:00.000Z';
const validNow = Date.parse('2026-11-17T09:00:00.000Z');

test('valid server expiry still counts down normally', () => {
  assert.equal(openEventMsLeft(expiresAt, validNow), 60_000);
  assert.equal(isOpenEventAvailable(expiresAt, validNow), true);
  assert.equal(openEventClockLabel(expiresAt, validNow), '01:00');
  assert.equal(openEventClockLabel(expiresAt, validNow + 60_000), '00:00');
});

test('invalid client clocks fail closed without NaN or Infinity in UI', () => {
  for (const now of [NaN, Infinity, -Infinity]) {
    assert.equal(openEventMsLeft(expiresAt, now), 0);
    assert.equal(isOpenEventAvailable(expiresAt, now), false);
    assert.equal(openEventClockLabel(expiresAt, now), '00:00');
  }
});

test('missing or invalid server expiry never enables a stale event', () => {
  for (const expiry of [undefined, null, '', 'not-a-date']) {
    assert.equal(openEventMsLeft(expiry, validNow), 0);
    assert.equal(isOpenEventAvailable(expiry, validNow), false);
    assert.equal(openEventClockLabel(expiry, validNow), '00:00');
  }
});
