import test from 'node:test';
import assert from 'node:assert/strict';
import { abortMatchedDuel } from '../src/db/abortMatchedDuel.ts';

const duelId = '12345678-1234-4234-8234-123456789abc';
const otherId = '12345678-1234-4234-8234-123456789abd';

test('lost abort acknowledgement does not report success; confirmed retry does', async () => {
  let calls = 0;
  const client = { rpc: async (name, args) => {
    assert.equal(name, 'abort_duel');
    assert.deepEqual(args, { p_duel_id: duelId });
    if (++calls === 1) throw new Error('connection lost');
    return { data: { id: duelId, status: 'abandoned' }, error: null };
  }};
  await assert.rejects(abortMatchedDuel(client, duelId), /connection lost/);
  assert.deepEqual(await abortMatchedDuel(client, duelId), { id: duelId, status: 'abandoned' });
  assert.equal(calls, 2);
});

test('abort refuses missing, foreign or non-abandoned server acknowledgement', async () => {
  for (const data of [null, { id: otherId, status: 'abandoned' },
    { id: duelId, status: 'finished' }, { id: duelId, status: 'matched' }]) {
    await assert.rejects(abortMatchedDuel({ rpc: async () => ({ data, error: null }) }, duelId),
      /nicht vom Server bestätigt/);
  }
});

test('abort propagates RPC errors even when response contains abandoned status', async () => {
  const error = new Error('permission denied');
  await assert.rejects(abortMatchedDuel({ rpc: async () => ({
    data: { id: duelId, status: 'abandoned' }, error,
  }) }, duelId), e => e === error);
});
