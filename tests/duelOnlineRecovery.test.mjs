import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('duel recovery requests a visible reconnect refresh and removes its listener', () => {
  const source = readFileSync(new URL('../src/screens/MapScreen.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('const queue = createDuelRecoveryQueue(');
  const end = source.indexOf('// No Realtime subscription', start);
  assert.ok(start >= 0 && end > start);
  const recovery = source.slice(start, end);
  assert.match(recovery, /window\.addEventListener\('online', whenVisible\)/);
  assert.match(recovery, /window\.removeEventListener\('online', whenVisible\)/);
  assert.match(recovery, /const whenVisible = \(\) => \{\s*if \(document\.visibilityState === 'visible'\) \{\s*queue\.request\(\)/);
  assert.match(recovery, /active = false;\s*queue\.close\(\)/);
});
