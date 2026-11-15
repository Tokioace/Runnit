import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openEventClockLabel, openEventMsLeft, isOpenEventAvailable } from '../src/lib/duelExpiry.ts';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('60-minute race popup starts from the server deadline, not from popup open time', () => {
  const expiresAt = '2026-11-15T20:00:00.000Z';
  assert.equal(openEventClockLabel(expiresAt, Date.parse('2026-11-15T19:14:00Z')), '46:00');
  assert.equal(openEventClockLabel(expiresAt, Date.parse('2026-11-15T19:59:51Z')), '00:09');
  assert.equal(openEventMsLeft(expiresAt, Date.parse('2026-11-15T20:00:00Z')), 0);
  assert.equal(isOpenEventAvailable(expiresAt, Date.parse('2026-11-15T20:00:00Z')), false);
});

test('own and foreign REAL event flags share one visible popup countdown, demos do not', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(renderer, /function detailElement\(run: ArcadeVectorRun,/);
  assert.match(renderer, /if \(!run.isDemo && run.expiresAt\) \{/);
  assert.match(renderer, /countdown.className = 'runnit-gl-run-expiry'/);
  assert.match(renderer, /label.textContent = 'EVENT ENDET IN'/);
  assert.match(renderer, /clock.dateTime = run.expiresAt/);
  assert.match(renderer, /clock.textContent = openEventClockLabel\(run.expiresAt\)/);
  assert.match(renderer, /button.textContent = run.isOwn \? 'ABSAGEN' : 'BEITRETEN »'/);
  const css = read('src/styles/maplibreArcade.css');
  assert.match(css, /\.runnit-gl-run-expiry>time\{/);
  assert.match(css, /\.runnit-gl-run-expiry.is-urgent>time\{/);
});

test('popup timer is strictly scoped to popup lifetime and disables expired joining', () => {
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.match(renderer, /if \(action\) action.disabled = true/);
  assert.match(renderer, /popup.remove\(\);\s*\/\/ The server cron expires the database row/);
  assert.match(renderer, /callbacks.current.onRunExpired\(selectedRun.id\)/);
  assert.match(renderer, /expiryInterval = window.setInterval\(updatePopupClock, 1000\)/);
  assert.match(renderer, /if \(expiryInterval !== null\) window.clearInterval\(expiryInterval\)/);
  assert.match(renderer, /document.removeEventListener\('visibilitychange', onPageVisible\)/);
  assert.match(renderer, /document.addEventListener\('visibilitychange', onPageVisible\)/);
  assert.match(renderer, /setDOMContent\(detail\)/);
});

test('expiry clears both local and country sources, even with no popup open', () => {
  const screen = read('src/screens/MapScreen.tsx');
  assert.match(screen, /onRunExpired=\{\(id\) => \{/);
  assert.match(screen, /setOpenRuns\(previous => previous.filter\(run => run.id !== id\)\)/);
  assert.match(screen, /setHostedOpenDuels\(previous => previous.filter\(run => run.id !== id\)\)/);
  assert.match(screen, /setRegionalRuns\(previous => previous.filter\(run => run.id !== id\)\)/);
  assert.match(screen, /setRegionalRuns\(previous => \{/);
  assert.match(screen, /window.setInterval\(pruneExpired, 1000\)/);
  assert.match(screen, /expiresAt: row.expires_at as string/);
  assert.doesNotMatch(screen, /<OpenEventCountdown/);
  // Server cron expires only unjoined "open" challenges.
  const cron = read('db/one_active_event_60min_cron.sql');
  assert.match(cron, /SET status = 'expired'\s+WHERE status = 'open' AND expires_at <= now\(\)/);
  assert.doesNotMatch(cron, /DELETE FROM public.duels/);
});

test('small blue GPS satellite is only on zoomed-out orbs; no street-level flag satellite', () => {
  const css = read('src/styles/maplibreArcade.css');
  const lib = read('src/lib/mapCommunityLayers.ts');
  const renderer = read('src/components/map/ArcadeMapLibreView.tsx');
  assert.doesNotMatch(css, /\.runnit-gl-marker\.runnit-gl-run\.is-own\[data-gps-in-radius=/);
  assert.doesNotMatch(css, /\.runnit-gl-marker\.runnit-gl-run\.is-own\[data-gps-nearby=/);
  assert.match(lib, /COMMUNITY_OWN_GPS_SATELLITE_DOT/);
  assert.match(lib, /'circle-opacity': \['interpolate', \['linear'\], \['zoom'\], 0, 1, 12\.2, 1, 12\.8, 0\]/);
  assert.doesNotMatch(renderer, /mergedIntoVisiblePin/);
  assert.match(renderer, /updateMarker\(gpsMarkerRef.current, gps\)/);
});
