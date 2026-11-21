import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileOpenRaces } from '../src/lib/reconcileOpenRaces.ts';

test('unresolved host identity never preserves a stale marker', () => {
  const previous = [{ id: 'stale', hostUserId: '' }];
  for (const unresolvedId of ['', ' ', '\t']) {
    assert.deepEqual(reconcileOpenRaces(previous, [], unresolvedId), []);
  }
});

test('known host identity still retains a locally hosted race during a discovery gap', () => {
  const own = { id: 'own', hostUserId: 'host-1' };
  assert.deepEqual(reconcileOpenRaces([own], [], 'host-1'), [own]);
});

test('unresolved host identity does not hide races actually returned by discovery', () => {
  const remote = { id: 'remote', hostUserId: 'other-host' };
  assert.deepEqual(reconcileOpenRaces([], [remote], ''), [remote]);
});
