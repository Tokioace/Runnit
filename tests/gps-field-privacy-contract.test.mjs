import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx', import.meta.url), 'utf8');

test('GPS field measurement is explicitly user-initiated and stopped on backgrounding', () => {
  assert.ok(source.includes('onClick={prepare}'), 'GPS preparation must require a button action');
  assert.ok(source.includes('navigator.geolocation.watchPosition('), 'GPS watch should be started only by preparation');
  assert.ok(source.includes("document.addEventListener('visibilitychange', pauseIfBackgrounded)"));
  assert.ok(source.includes("window.addEventListener('pagehide', stopOnPageHide)"));
  assert.ok(source.includes('navigator.geolocation.clearWatch(watchId.current)'));
  assert.ok(source.includes('stopWatching();'), 'watch cleanup must remain available');
});

test('GPS field report export is explicitly requested and excludes raw track data', () => {
  assert.ok(source.includes('onClick={downloadReport}'), 'report export must be user-triggered');
  assert.ok(source.includes("schema: 'runnit-gps-field-v1'"));
  assert.ok(source.includes('...report,'));
  assert.ok(source.includes('staleFixesIgnored: skippedStale'));
  assert.ok(source.includes("JSON.stringify(exported, null, 2)"));
  // This test is a source-level guard, not a substitute for reviewing the
  // createExperimentalRunReport implementation or dynamic privacy tests.
  const exportBlock = source.split('const exported = {')[1]?.split('};')[0] ?? '';
  for (const forbidden of ['latitude:', 'longitude:', 'track:', 'samples:', 'coordinates:']) {
    assert.ok(!exportBlock.includes(forbidden), `raw GPS field in export: ${forbidden}`);
  }
});

test('field GPS measurements never submit results or persist a track', () => {
  for (const forbidden of ['submitDuelResult(', 'localStorage.setItem(', 'sessionStorage.setItem(', 'fetch(', 'supabase.from(', 'supabase.rpc(']) {
    assert.ok(!source.includes(forbidden), `field test must not use ${forbidden}`);
  }
  assert.ok(source.includes('nicht ranglistenfähig'));
});
