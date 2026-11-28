import test from 'node:test';
import assert from 'node:assert/strict';
import { determineDuelOutcome } from '../src/lib/duelOutcome.ts';

const host = '20e00385-9812-4666-9bca-3586f78fa711';
const guest = '20e00385-9812-4666-9bca-3586f78fa712';
const result = (hostTime, guestTime) => [
  { user_id: host, time_ms: hostTime },
  { user_id: guest, time_ms: guestTime },
];

test('incomplete, invalid and non-finite server times never declare a winner', () => {
  for (const invalid of [NaN, Infinity, -Infinity, 0, -1]) {
    assert.equal(determineDuelOutcome(result(invalid, 10_000), host, 'completed'), 'pending');
    assert.equal(determineDuelOutcome(result(10_000, invalid), guest, 'completed'), 'pending');
  }
});

test('terminal statuses other than completed do not award a result', () => {
  const times = result(9_000, 10_000);
  for (const status of ['open', 'matched', 'abandoned', 'cancelled', 'expired', '']) {
    assert.equal(determineDuelOutcome(times, host, status), 'pending');
    assert.equal(determineDuelOutcome(times, guest, status), 'pending');
  }
});

test('a duplicate or unrelated server runner cannot produce a winner', () => {
  const outsider = '20e00385-9812-4666-9bca-3586f78fa713';
  const duplicate = [{ user_id: host, time_ms: 9_000 }, { user_id: host, time_ms: 10_000 }];
  assert.equal(determineDuelOutcome(duplicate, host, 'completed'), 'pending');
  assert.equal(determineDuelOutcome(result(9_000, 10_000), outsider, 'completed'), 'pending');
});

test('valid ties and strict positive finishing times remain symmetric for both runners', () => {
  assert.equal(determineDuelOutcome(result(1, 1), host, 'completed'), 'tie');
  assert.equal(determineDuelOutcome(result(1, 1), guest, 'completed'), 'tie');
  assert.equal(determineDuelOutcome(result(1, 2), host, 'completed'), 'won');
  assert.equal(determineDuelOutcome(result(1, 2), guest, 'completed'), 'lost');
  assert.equal(determineDuelOutcome(result(2, 1), host, 'completed'), 'lost');
  assert.equal(determineDuelOutcome(result(2, 1), guest, 'completed'), 'won');
});
