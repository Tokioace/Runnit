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

test('visible websocket resubscription requests the existing scoped match recovery queue', () => {
  const source = readFileSync(new URL('../src/screens/MapScreen.tsx', import.meta.url), 'utf8');
  const recovery = source.slice(source.indexOf('// Mobile Safari may suspend Realtime'), source.indexOf('// No Realtime subscription'));
  const realtime = source.slice(source.indexOf('// No Realtime subscription'), source.indexOf('// The server is the authority for expiration'));
  assert.match(recovery, /requestMatchRecoveryRef.current = queue.request;/);
  assert.match(recovery, /if \(requestMatchRecoveryRef.current === queue.request\) \{\s*requestMatchRecoveryRef.current = null;/);
  assert.match(realtime, /\.subscribe\(status => \{\s*if \(!lifetime.isActive\(\) \|\| finishAccountRef.current !== authUser.id\) return;[\s\S]*?if \(status === 'SUBSCRIBED' && document.visibilityState === 'visible'\) \{\s*requestMatchRecoveryRef.current\?\.\(\);\s*\}/);
  assert.equal((realtime.match(/requestMatchRecoveryRef.current\?\.\(\)/g) ?? []).length, 1);
});
