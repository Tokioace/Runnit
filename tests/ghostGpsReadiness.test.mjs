import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectGhostGpsFix, ghostGpsFixNotice } from '../src/lib/ghostGpsReadiness.ts';

const t = 200_000;
const sample = (timestampMs, accuracyM=4.9) => ({
  latitude: 48.94, longitude: 9.43, timestampMs, accuracyM,
});
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('iOS 4.9m accuracy does not imply a fresh GPS timestamp', () => {
  const stale = inspectGhostGpsFix(sample(t-12_000),t);
  assert.equal(stale.issue,'stale');
  assert.equal(stale.accuracyM,4.9);
  assert.equal(stale.ageMs,12_000);
  assert.match(ghostGpsFixNotice(stale), /älter als 3 Sekunden/);
  const fresh = inspectGhostGpsFix(sample(t-1000),t);
  assert.equal(fresh.issue,'ready');
  assert.equal(fresh.ageMs,1000);
});

test('iOS GPS readiness does not accept future timestamps, unbounded errors, or wrong accuracies', () => {
  assert.equal(inspectGhostGpsFix(sample(t+1700),t).issue,'future-timestamp');
  assert.equal(inspectGhostGpsFix(sample(t-3001),t).issue,'stale');
  assert.equal(inspectGhostGpsFix(sample(t-3000),t).issue,'ready');
  assert.equal(inspectGhostGpsFix(sample(t,15),t).issue,'ready');
  assert.equal(inspectGhostGpsFix(sample(t,15.1),t).issue,'poor-accuracy');
  assert.equal(inspectGhostGpsFix(sample(t,NaN),t).issue,'invalid');
  assert.equal(inspectGhostGpsFix(null,t).issue,'missing');
  assert.equal(inspectGhostGpsFix({ ...sample(t), latitude: Infinity },t).issue,'invalid');
});

test('GhostRun does not stay permanently disabled if iOS supplies accurate stale fixes', () => {
  const ui = source('src/screens/GhostRunScreen.tsx');
  assert.match(ui,/inspectGhostGpsFix\(sample, observedNow\)/);
  assert.match(ui,/if \(info.issue === 'ready' && isFreshStartFix\(sample, observedNow\)\)/);
  assert.match(ui,/ghostFixOrder\(latestPreparationFixMs.current, sample, observedNow\)/);
  assert.match(ui,/navigator.geolocation.getCurrentPosition\(/);
  assert.match(ui,/maximumAge: 0, timeout: 7000/);
  assert.match(ui,/window.setInterval\(requestFreshFix, 5000\)/);
  assert.match(ui,/FRISCHEN GPS-FIX ANFORDERN/);
  assert.match(ui,/LETZTER GPS-FIX/);
  assert.doesNotMatch(ui,/disabled=\{phase === 'acquiring'\}>\s*\{phase === 'acquiring'/);
});
