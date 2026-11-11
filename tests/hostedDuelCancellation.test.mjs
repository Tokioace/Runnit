import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  cancelHostedOpenDuel, cancelHostedDuelMessage, listHostedOpenDuels,
} from '../src/db/cancelHostedDuel.ts';

const host = 'd7c19625-40ac-4c53-a52f-b0657a412b8e';
const duel = '1c4ee7a1-3af8-498c-969a-fbb79d9b0a51';
const secondDuel = '76241b76-1a99-4d73-863c-28b0f60e0a13';

function updateClient(result) {
  const calls = [];
  const query = {
    eq(key, value) { calls.push(['eq', key, value]); return this; },
    is(key, value) { calls.push(['is', key, value]); return this; },
    select(columns) { calls.push(['select', columns]); return Promise.resolve(result); },
  };
  return {
    calls,
    from(table) {
      calls.push(['from', table]);
      return {
        update(value) { calls.push(['update', value]); return query; },
      };
    },
  };
}

test('host cancellation changes only status on one open unjoined owned row', async () => {
  const client = updateClient({ data: [{ id: duel, status: 'cancelled' }], error: null });
  const result = await cancelHostedOpenDuel(client, duel, host);
  assert.deepEqual(result, { status: 'cancelled' });
  assert.deepEqual(client.calls, [
    ['from', 'duels'], ['update', { status: 'cancelled' }],
    ['eq', 'id', duel], ['eq', 'host_user_id', host], ['eq', 'status', 'open'],
    ['is', 'challenger_user_id', null], ['select', 'id, status'],
  ]);
  assert.match(cancelHostedDuelMessage(result), /erfolgreich abgesagt/);
});

test('zero-row response never counts as a successful cancellation', async () => {
  const client = updateClient({ data: [], error: null });
  const result = await cancelHostedOpenDuel(client, duel, host);
  assert.deepEqual(result, { status: 'not-cancelled', reason: 'not-open-or-forbidden' });
  assert.match(cancelHostedDuelMessage(result), /nicht abgesagt/);
});

test('returned cancellation must match requested id and status', async () => {
  assert.equal((await cancelHostedOpenDuel(updateClient({ data: [{ id: secondDuel, status: 'cancelled' }], error: null }), duel, host)).status, 'not-cancelled');
  assert.equal((await cancelHostedOpenDuel(updateClient({ data: [{ id: duel, status: 'open' }], error: null }), duel, host)).status, 'not-cancelled');
});

test('server permissions and network failures must keep duel visible to user', async () => {
  const forbidden = await cancelHostedOpenDuel(updateClient({ data: null, error: { code: '42501', message: 'Forbidden' } }), duel, host);
  assert.deepEqual(forbidden, { status: 'not-cancelled', reason: 'permission' });
  const other = await cancelHostedOpenDuel(updateClient({ data: null, error: { code: 'XX000', message: 'Error' } }), duel, host);
  assert.equal(other.reason, 'server');
  const failure = await cancelHostedOpenDuel({
    from() { throw new Error('Failed to fetch'); },
  }, duel, host);
  assert.equal(failure.reason, 'network');
});

test('rejects invalid ids before a database call', async () => {
  const invalid = { from() { throw new Error('Must not be called'); } };
  assert.equal((await cancelHostedOpenDuel(invalid, 'demo-run-1', host)).status, 'not-cancelled');
  assert.equal((await cancelHostedOpenDuel(invalid, duel, '')).status, 'not-cancelled');
});

test('own open-lobby query requires host ownership and no challenger', async () => {
  const calls = [];
  const rows = [
    { id: duel, host_user_id: host, target_distance_m: 50, created_at: '2026-11-11T18:00:00Z' },
    { id: secondDuel, host_user_id: '00000000-0000-4000-8000-000000000000', target_distance_m: 75 },
  ];
  const q = {
    select(value) { calls.push(['select', value]); return this; },
    eq(key, value) { calls.push(['eq', key, value]); return this; },
    is(key, value) { calls.push(['is', key, value]); return this; },
    order(key, value) { calls.push(['order', key, value]); return this; },
    limit(value) { calls.push(['limit', value]); return Promise.resolve({ data: rows, error: null }); },
  };
  const client = { from(table) { calls.push(['from', table]); return q; } };
  const result = await listHostedOpenDuels(client, host);
  assert.deepEqual(result, [{ id: duel, hostUserId: host, distanceMeters: 50, createdAt: '2026-11-11T18:00:00Z' }]);
  assert.deepEqual(calls, [
    ['from', 'duels'], ['select', 'id, host_user_id, target_distance_m, created_at'],
    ['eq', 'host_user_id', host], ['eq', 'status', 'open'], ['is', 'challenger_user_id', null],
    ['order', 'created_at', { ascending: false }], ['limit', 20],
  ]);
});

test('map offers visible hosted cancellation, explicit confirmation and accessible solo race demo', () => {
  const map = readFileSync(new URL('../src/screens/MapScreen.tsx', import.meta.url), 'utf8');
  const arena = readFileSync(new URL('../src/screens/SprintArenaLabScreen.tsx', import.meta.url), 'utf8');
  assert.match(map, /Meine offenen Rennen/);
  assert.match(map, /listHostedOpenDuels\(supabase, authUser\.id\)/);
  assert.match(map, /cancelHostedOpenDuel\(supabase, run\.id, authUser\.id\)/);
  assert.match(map, /result\.status === 'cancelled'/);
  assert.match(map, /aria-modal="true"/);
  assert.match(map, /Rennen wirklich absagen\?/);
  assert.doesNotMatch(map, /window\.confirm\(/);
  assert.match(map, /Renn-Grafik testen · Demo ohne zweiten Läufer/);
  assert.match(map, /navigate\('\/sprint-lab'\)/);
  assert.match(arena, /DEMO · KEINE ECHTEN LÄUFER/);
  assert.match(map, /onDemo=\{\(\) =>/);
});
