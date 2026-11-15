import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  OPEN_EVENT_LIFETIME_MINUTES, OPEN_EVENT_LIFETIME_MS,
  openEventMsLeft, openEventClockLabel, isOpenEventAvailable,
  isHostSlotBlocked, isDuplicateActiveHostEventError,
} from '../src/lib/duelExpiry.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('60-minute countdown uses fixed server timestamp and survives a page refresh', () => {
  const start = Date.parse('2026-11-15T18:00:00.000Z');
  const expiresAt = '2026-11-15T19:00:00.000Z';
  assert.equal(OPEN_EVENT_LIFETIME_MINUTES, 60);
  assert.equal(OPEN_EVENT_LIFETIME_MS, 3_600_000);
  assert.equal(openEventClockLabel(expiresAt, start), '60:00');
  assert.equal(openEventClockLabel(expiresAt, start + 12_345), '59:48');
  assert.equal(openEventClockLabel(expiresAt, start + 3_599_001), '00:01');
  assert.equal(openEventClockLabel(expiresAt, start + 3_600_000), '00:00');
  assert.equal(openEventClockLabel(expiresAt, start + 3_601_000), '00:00');
  assert.equal(openEventMsLeft(expiresAt, start + 1_000), 3_599_000);
  assert.equal(isOpenEventAvailable(expiresAt, start + 3_599_999), true);
  assert.equal(isOpenEventAvailable(expiresAt, start + 3_600_000), false);
  assert.equal(isOpenEventAvailable('invalid-timestamp', start), false);
  assert.equal(isOpenEventAvailable(null, start), false);
});

test('one host slot for every open or matched challenge, including overlapping tabs', () => {
  assert.equal(isHostSlotBlocked('open'), true);
  assert.equal(isHostSlotBlocked('matched'), true);
  for (const status of ['completed', 'cancelled', 'expired', 'abandoned']) {
    assert.equal(isHostSlotBlocked(status), false);
  }
  assert.equal(isDuplicateActiveHostEventError({
    code: '23505', message: 'duplicate key violates unique constraint "duels_one_inflight_host_uidx"',
  }), true);
  assert.equal(isDuplicateActiveHostEventError({ code: '23505', message: 'some other unique index' }), false);
  assert.equal(isDuplicateActiveHostEventError({ code: '42501' }), false);

  const sql = read('db/one_active_event_60min_lifecycle.sql');
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS duels_one_inflight_host_uidx/);
  assert.match(sql, /ON public\.duels\(host_user_id\)/);
  assert.match(sql, /status IN \('open', 'matched'\)/);
  assert.match(sql, /NEW\.expires_at := NEW\.created_at \+ interval '60 minutes'/);
  assert.match(sql, /NEW\.created_at := statement_timestamp\(\)/);
  assert.match(sql, /Challenge expiry is server-controlled/);
  assert.match(sql, /auth\.uid\(\) IS NULL/);
});

test('server expiry and matching reject stale lobbies even before cron executes', () => {
  const sql = read('db/one_active_event_60min_lifecycle.sql');
  assert.match(sql, /WHERE status = 'open'\s+AND expires_at > now\(\)/);
  assert.match(sql, /v_duel\.expires_at <= statement_timestamp\(\)/);
  assert.match(sql, /AND expires_at > statement_timestamp\(\)/);
  assert.match(sql, /WHERE status = 'open' AND expires_at <= now\(\)/);
  assert.match(sql, /OLD\.status = 'matched' AND NEW\.status = 'completed'/);
  assert.match(sql, /Both participants must finish before completing/);
  assert.match(sql, /UPDATE public\.duels d\s+SET status = 'completed'/);
});

test('cron retires expired lobbies every minute without aborting running matches after 60m', () => {
  const sql = read('db/one_active_event_60min_cron.sql');
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pg_cron/);
  assert.match(sql, /'runnit-expire-open-and-abandoned-duels'/);
  assert.match(sql, /'\* \* \* \* \*'/);
  assert.match(sql, /SET status = 'expired'\s+WHERE status = 'open' AND expires_at <= now\(\)/);
  assert.match(sql, /start_at IS NULL AND matched_at <= now\(\) - interval '30 minutes'/);
  assert.match(sql, /start_at IS NOT NULL AND start_at <= now\(\) - interval '4 hours'/);
  assert.doesNotMatch(sql, /DELETE FROM public\.duels/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.runnit_close_stale_duels\(\) FROM PUBLIC/);
});

test('countdown is isolated from expensive MapLibre render, with expiry on map and in list', () => {
  const timer = read('src/components/map/OpenEventCountdown.tsx');
  const screen = read('src/screens/MapScreen.tsx');
  const cards = read('src/components/map/ArcadeMapChrome.tsx');
  const hosted = read('src/db/cancelHostedDuel.ts');
  const created = read('src/db/createDuel.ts');
  assert.match(timer, /window\.setInterval\(tick, 1000\)/);
  assert.match(timer, /visibilitychange/);
  assert.match(timer, /openEventClockLabel\(expiresAt, nowMs\)/);
  assert.match(timer, /onExpire\?\.\(\)/);
  assert.match(screen, /<OpenEventCountdown/);
  assert.match(screen, /setOpenRuns\(prev => prev\.filter\(item => item\.id !== run\.id\)\)/);
  assert.match(cards, /<OpenEventCountdown expiresAt=\{entry\.expiresAt\}/);
  assert.match(hosted, /select\('id, host_user_id, target_distance_m, created_at, expires_at, location'\)/);
  assert.match(created, /created_at, expires_at/);
  assert.match(screen, /\.in\('status', \['open', 'matched'\]\)/);
  assert.match(screen, /\.gt\('expires_at', new Date\(\)\.toISOString\(\)\)/);
  assert.doesNotMatch(screen, /Auto-expire duels older than 30 minutes/);
});
