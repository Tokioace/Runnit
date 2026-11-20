import test from 'node:test';
import assert from 'node:assert/strict';
import { isHostSlotBlocked, isDuplicateActiveHostEventError } from '../src/lib/duelExpiry.ts';

test('open and matched host events block another hosted duel', () => {
  for (const status of ['open', 'matched']) assert.equal(isHostSlotBlocked(status), true);
  for (const status of ['cancelled', 'completed', 'expired', 'aborted', '']) {
    assert.equal(isHostSlotBlocked(status), false);
  }
});

test('only the expected unique-index violation is treated as an active host duplicate', () => {
  assert.equal(isDuplicateActiveHostEventError({ code: '23505', message: 'duplicate key violates unique constraint "duels_one_inflight_host_uidx"' }), true);
  assert.equal(isDuplicateActiveHostEventError({ code: '23505', message: 'duplicate key violates unique constraint "other_index"' }), false);
  assert.equal(isDuplicateActiveHostEventError({ code: '42501', message: 'duels_one_inflight_host_uidx' }), false);
});

test('malformed database errors do not masquerade as duplicate-host conflicts', () => {
  for (const error of [null, undefined, '23505', 23505, {}, { code: 23505, message: 'duels_one_inflight_host_uidx' }, { code: '23505', message: null }]) {
    assert.equal(isDuplicateActiveHostEventError(error), false);
  }
});
