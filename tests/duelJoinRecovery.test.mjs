import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { joinDuel } from '../src/db/joinDuel.ts';

const duelId = '0cfa7d14-d060-44e4-a0e6-753fa308f8ee';
const challenger = '5bf1a113-a5d1-4882-8526-9c6a65344fb3';

test('join accepts only the confirmed matched RPC row', async () => {
  const calls = [];
  const joined = { id: duelId, status: 'matched', challenger_user_id: challenger, start_at: null };
  const client = { rpc(name, args) {
    calls.push([name, args]);
    return Promise.resolve({ data: joined, error: null });
  } };
  assert.deepEqual(await joinDuel(client, duelId), joined);
  assert.deepEqual(calls, [['join_duel', { duel_id: duelId }]]);
});

test('Supabase RPC errors must reject, not silently appear successful', async () => {
  const error = { code: '23514', message: 'Challenge expired or unavailable' };
  const client = { rpc() { return Promise.resolve({ data: null, error }); } };
  await assert.rejects(joinDuel(client, duelId), received => received === error);
});

test('missing or unconfirmed RPC data cannot start a race', async () => {
  for (const data of [null, { id: duelId, status: 'open' }, { id: 'other', status: 'matched' }]) {
    await assert.rejects(
      joinDuel({ rpc: async () => ({ data, error: null }) }, duelId),
      /not confirmed by the database/,
    );
  }
});

test('map handles confirmed join directly and recovers missed realtime events', () => {
  const map = readFileSync(new URL('../src/screens/MapScreen.tsx', import.meta.url), 'utf8');
  assert.match(map, /const confirmed = await joinDuel\(supabase, run\.id\)/);
  assert.match(map, /confirmed\.challenger_user_id !== authUser\.id/);
  assert.match(map, /applyMatchedDuel\(confirmed\)/);
  assert.match(map, /applyMatchedDuel\(row\)/);
  assert.match(map, /document\.addEventListener\('visibilitychange', whenVisible\)/);
  assert.match(map, /\.eq\('status', 'matched'\)/);
  assert.match(map, /setOpenRuns\(previous => previous\.filter\(run => run\.id !== row\.id\)\)/);
  assert.match(map, /latest\?\.status === 'matched'/);
  assert.match(map, /setCancelConfirmation\(previous => previous\?\.id === row\.id \? null : previous\)/);
});

test('match does not start until both players are server-ready', () => {
  const map = readFileSync(new URL('../src/screens/MapScreen.tsx', import.meta.url), 'utf8');
  const backend = readFileSync(new URL('../db/one_active_event_60min_lifecycle.sql', import.meta.url), 'utf8');
  assert.match(map, /const confirmMatchReady = async \(\) =>/);
  assert.match(map, /const \{ data, error \} = await readyForDuel\(supabase, matchedDuel\.id\)/);
  assert.match(map, /const startAt = typeof row\.start_at === 'string'/);
  assert.match(map, /if \(startAt\) \{/);
  assert.match(map, /Beide Spieler müssen bereit sein/);
  assert.match(map, /<ReadyLobby/);
  assert.match(map, /<RaceCountdown/);
  assert.match(map, /if \(race\.status === 'countdown'\)/);
  assert.match(backend, /CREATE OR REPLACE FUNCTION public\.join_duel/);
  assert.match(backend, /status = 'matched'/);
});
