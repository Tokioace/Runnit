import test from 'node:test';
import assert from 'node:assert/strict';
import { mapWithConcurrency } from '../src/lib/mapWithConcurrency.ts';

test('limits concurrent reads to four and retains input order', async () => {
  const items = Array.from({ length: 15 }, (_, i) => i);
  let active = 0, peak = 0;
  const pending = [];
  const promise = mapWithConcurrency(items, 4, async item => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => pending.push(resolve));
    active--;
    return item * 2;
  });
  assert.equal(active, 4);
  for (let i = 0; i < items.length; i++) {
    assert.ok(pending.length > 0);
    pending.shift()();
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.deepEqual(await promise, items.map(x => x * 2));
  assert.equal(peak, 4);
  assert.equal(active, 0);
});

test('empty history triggers no RPCs', async () => {
  const result = await mapWithConcurrency([], 4, async () => { throw Error('unexpected'); });
  assert.deepEqual(result, []);
});

test('rejects invalid concurrency and propagates RPC failures', async () => {
  await assert.rejects(mapWithConcurrency([1], 0, async x => x), RangeError);
  await assert.rejects(mapWithConcurrency([1, 2], 2, async x => {
    if (x === 2) throw Error('RPC failed');
    return x;
  }), /RPC failed/);
});
