import test from 'node:test';
import assert from 'node:assert/strict';
import { readActiveDuelId, rememberActiveDuelId, forgetActiveDuelId } from '../src/lib/activeDuelStorage.ts';

const USER_A = 'f631fabd-b5b4-4dd5-9d59-1fd9c71cd011';
const USER_B = 'f631fabd-b5b4-4dd5-9d59-1fd9c71cd012';
const DUEL_A = 'f631fabd-b5b4-4dd5-9d59-1fd9c71cd013';
const DUEL_B = 'f631fabd-b5b4-4dd5-9d59-1fd9c71cd014';

function withWindow(localStorage, callback) {
  const original = globalThis.window;
  globalThis.window = { localStorage };
  try { callback(); }
  finally {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  }
}

test('duel recovery is isolated per account and cannot clear another active duel', () => {
  const entries = new Map();
  const storage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
    removeItem: key => { entries.delete(key); },
  };
  withWindow(storage, () => {
    rememberActiveDuelId(USER_A, DUEL_A);
    rememberActiveDuelId(USER_B, DUEL_B);
    assert.equal(readActiveDuelId(USER_A), DUEL_A);
    assert.equal(readActiveDuelId(USER_B), DUEL_B);
    forgetActiveDuelId(USER_A, DUEL_B);
    assert.equal(readActiveDuelId(USER_A), DUEL_A);
    forgetActiveDuelId(USER_A, DUEL_A);
    assert.equal(readActiveDuelId(USER_A), null);
    assert.equal(readActiveDuelId(USER_B), DUEL_B);
  });
});

test('Safari storage denial never crashes recovery or dismissal', () => {
  const storage = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => { throw new Error('SecurityError'); },
  };
  withWindow(storage, () => {
    assert.equal(readActiveDuelId(USER_A), null);
    assert.doesNotThrow(() => rememberActiveDuelId(USER_A, DUEL_A));
    assert.doesNotThrow(() => forgetActiveDuelId(USER_A, DUEL_A));
  });
});

test('invalid stored values are never treated as recoverable races', () => {
  const storage = {
    getItem: () => 'https://example.invalid/?lat=48.9&lon=9.4',
    setItem: () => { throw new Error('should not write'); },
    removeItem: () => { throw new Error('should not remove'); },
  };
  withWindow(storage, () => {
    assert.equal(readActiveDuelId(USER_A), null);
    assert.equal(readActiveDuelId('not-a-user-id'), null);
    assert.doesNotThrow(() => rememberActiveDuelId('not-a-user-id', DUEL_A));
    assert.doesNotThrow(() => rememberActiveDuelId(USER_A, 'not-a-duel-id'));
    assert.doesNotThrow(() => forgetActiveDuelId('not-a-user-id', DUEL_A));
  });
});
