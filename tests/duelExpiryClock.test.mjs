import assert from 'node:assert/strict';
import test from 'node:test';
import { openEventMsLeft, isOpenEventAvailable, openEventClockLabel } from '../src/lib/duelExpiry.ts';

const expiry = '2026-11-20T12:00:00.000Z';
const atExpiry = Date.parse(expiry);

test('open lobby expires exactly at server timestamp, not a second later', () => {
  assert.equal(openEventMsLeft(expiry, atExpiry - 1), 1);
  assert.equal(isOpenEventAvailable(expiry, atExpiry - 1), true);
  assert.equal(openEventClockLabel(expiry, atExpiry - 1), '00:01');
  assert.equal(openEventMsLeft(expiry, atExpiry), 0);
  assert.equal(isOpenEventAvailable(expiry, atExpiry), false);
  assert.equal(openEventClockLabel(expiry, atExpiry), '00:00');
  assert.equal(openEventClockLabel(expiry, atExpiry + 60000), '00:00');
});

test('open lobby clock handles minute boundary without showing 00:60', () => {
  assert.equal(openEventClockLabel(expiry, atExpiry - 60000), '01:00');
  assert.equal(openEventClockLabel(expiry, atExpiry - 60001), '01:01');
  assert.equal(openEventClockLabel(expiry, atExpiry - 3599999), '60:00');
});

test('invalid or absent server expiry fails closed', () => {
  for (const value of [null, undefined, '', 'not-a-date']) {
    assert.equal(isOpenEventAvailable(value, atExpiry), false);
    assert.equal(openEventClockLabel(value, atExpiry), '00:00');
  }
  assert.equal(isOpenEventAvailable(expiry, Number.NaN), false);
});

test('offset-aware server timestamps give identical expiry', () => {
  const offsetExpiry = '2026-11-20T13:00:00.000+01:00';
  assert.equal(openEventMsLeft(offsetExpiry, atExpiry - 1000), 1000);
  assert.equal(openEventClockLabel(offsetExpiry, atExpiry - 1000), '00:01');
});
