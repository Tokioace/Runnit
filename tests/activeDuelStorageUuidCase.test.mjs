import test from 'node:test';
import assert from 'node:assert/strict';
import { readActiveDuelId, rememberActiveDuelId, forgetActiveDuelId } from '../src/lib/activeDuelStorage.ts';

const USER = 'f631fabd-b5b4-4dd5-9d59-1fd9c71cd011';
const DUEL = 'f631fabd-b5b4-4dd5-9d59-1fd9c71cd013';
const OTHER = 'f631fabd-b5b4-4dd5-9d59-1fd9c71cd014';

test('dismissal accepts equivalent mixed-case UUIDs but preserves a newer duel', () => {
  const entries = new Map();
  const oldWindow = globalThis.window;
  globalThis.window = { localStorage: {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key),
  } };
  try {
    rememberActiveDuelId(USER, DUEL.toUpperCase());
    assert.equal(readActiveDuelId(USER), DUEL.toUpperCase());
    forgetActiveDuelId(USER, DUEL);
    assert.equal(readActiveDuelId(USER), null);

    rememberActiveDuelId(USER, OTHER);
    forgetActiveDuelId(USER, DUEL.toUpperCase());
    assert.equal(readActiveDuelId(USER), OTHER);

    forgetActiveDuelId(USER, OTHER.toUpperCase());
    assert.equal(readActiveDuelId(USER), null);
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
  }
});
