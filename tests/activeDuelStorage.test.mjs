import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readActiveDuelId, rememberActiveDuelId, forgetActiveDuelId } from '../src/lib/activeDuelStorage.ts';

test('storage recovery saves only UUIDs and forgets only matching duel', () => {
  const oldWindow = globalThis.window;
  const bag = new Map();
  globalThis.window = { localStorage: {
    getItem: name => bag.get(name) ?? null,
    setItem: (name, value) => { bag.set(name, value); },
    removeItem: name => { bag.delete(name); },
  }};
  try {
    const user = 'f631fabd-b5b4-4dd5-9d59-1fd9c71cd001';
    const duel = 'f631fabd-b5b4-4dd5-9d59-1fd9c71cd002';
    assert.equal(readActiveDuelId(user), null);
    rememberActiveDuelId(user, 'not-a-duel');
    assert.equal(readActiveDuelId(user), null);
    rememberActiveDuelId(user, duel);
    assert.equal(readActiveDuelId(user), duel);
    forgetActiveDuelId(user, 'f631fabd-b5b4-4dd5-9d59-1fd9c71cd003');
    assert.equal(readActiveDuelId(user), duel);
    forgetActiveDuelId(user, duel);
    assert.equal(readActiveDuelId(user), null);
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
  }
});

test('MapScreen saves matched duel and can recover completed match after Safari reload', () => {
  const map = readFileSync(new URL('../src/screens/MapScreen.tsx', import.meta.url), 'utf8');
  assert.match(map, /rememberActiveDuelId\(authUser\.id, row\.id\)/);
  assert.match(map, /activeDuelIdRef\.current \|\| readActiveDuelId\(authUser\.id\)/);
  assert.match(map, /if \(latest\?\.status === 'completed'\)/);
  assert.match(map, /forgetActiveDuelId\(authUser\.id, duelId\)/);
});
