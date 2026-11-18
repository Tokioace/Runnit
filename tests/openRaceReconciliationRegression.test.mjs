import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileOpenRaces } from '../src/lib/reconcileOpenRaces.ts';

const ownHostId = 'host-1';
const own = Object.freeze({ id: 'own-race', hostUserId: ownHostId, label: 'original' });
const other = Object.freeze({ id: 'other-race', hostUserId: 'host-2', label: 'original' });

test('a temporary discovery gap retains only the locally hosted real race', () => {
  const previous = Object.freeze([own, other]);
  assert.deepEqual(reconcileOpenRaces(previous, [], ownHostId), [own]);
  assert.deepEqual(previous, [own, other]);
});

test('server refresh replaces stale objects without reordering visible races', () => {
  const updatedOther = { ...other, label: 'updated' };
  const updatedOwn = { ...own, label: 'updated' };
  const newRace = { id: 'new-race', hostUserId: 'host-3' };
  const result = reconcileOpenRaces([own, other], [newRace, updatedOther, updatedOwn], ownHostId);
  assert.deepEqual(result, [updatedOwn, updatedOther, newRace]);
  assert.equal(result[0], updatedOwn);
  assert.equal(result[1], updatedOther);
});

test('demo races are not preserved when absent from server discovery', () => {
  const demo = { id: 'demo-run-42', hostUserId: ownHostId };
  assert.deepEqual(reconcileOpenRaces([demo, other], [], ownHostId), []);
});

test('discovery removes vanished third-party races and does not duplicate own race', () => {
  const refreshedOwn = { ...own, label: 'server' };
  const result = reconcileOpenRaces([own, other], [refreshedOwn, refreshedOwn], ownHostId);
  assert.deepEqual(result, [refreshedOwn]);
});

test('new races are appended in discovery order after existing visible races', () => {
  const newcomerA = { id: 'a', hostUserId: 'host-a' };
  const newcomerB = { id: 'b', hostUserId: 'host-b' };
  assert.deepEqual(
    reconcileOpenRaces([other], [newcomerA, other, newcomerB], ownHostId),
    [other, newcomerA, newcomerB],
  );
});


test('duplicate previous markers collapse to one current server race', () => {
  const staleDuplicate = { ...own, label: 'stale duplicate' };
  const latest = { ...own, label: 'server truth' };
  const result = reconcileOpenRaces([own, staleDuplicate, other], [latest], ownHostId);
  assert.deepEqual(result, [latest]);
  assert.equal(result[0], latest);
});

test('repeated server entries cannot create multiple markers for the same race', () => {
  const first = { ...other, label: 'old payload' };
  const last = { ...other, label: 'latest payload' };
  assert.deepEqual(reconcileOpenRaces([], [first, last], ownHostId), [last]);
});

test('a locally hosted race survives duplicate previous entries during an empty refresh', () => {
  const result = reconcileOpenRaces([own, { ...own }], [], ownHostId);
  assert.deepEqual(result, [own]);
});
