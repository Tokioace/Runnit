import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readActiveDuelId,
  rememberActiveDuelId,
  forgetActiveDuelId,
} from '../src/lib/activeDuelStorage.ts';

const HOST = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const DUEL = '33333333-3333-4333-8333-333333333333';
const NEXT_DUEL = '44444444-4444-4444-8444-444444444444';
const KEY = 'runnit:active-duel:v1:';

function withStorage(run) {
  const previous = globalThis.window;
  const entries = new Map();
  globalThis.window = {
    localStorage: {
      getItem: key => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: key => entries.delete(key),
    },
  };
  try { run(entries); }
  finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
}

test('a remembered duel is scoped to its user and survives a subsequent read', () => {
  withStorage(entries => {
    rememberActiveDuelId(HOST, DUEL);
    assert.equal(readActiveDuelId(HOST), DUEL);
    assert.equal(readActiveDuelId(OTHER), null);
    assert.equal(entries.size, 1);
    assert.equal(entries.get(KEY + HOST), DUEL);
  });
});

test('dismissal cannot erase a newer race or another user race', () => {
  withStorage(() => {
    rememberActiveDuelId(HOST, DUEL);
    rememberActiveDuelId(HOST, NEXT_DUEL);
    rememberActiveDuelId(OTHER, DUEL);
    forgetActiveDuelId(HOST, DUEL);
    assert.equal(readActiveDuelId(HOST), NEXT_DUEL);
    forgetActiveDuelId(HOST, NEXT_DUEL);
    assert.equal(readActiveDuelId(HOST), null);
    assert.equal(readActiveDuelId(OTHER), DUEL);
  });
});

test('invalid IDs are neither persisted nor returned', () => {
  withStorage(entries => {
    rememberActiveDuelId(HOST, 'not-a-uuid');
    rememberActiveDuelId('not-a-user', DUEL);
    assert.equal(entries.size, 0);
    entries.set(KEY + HOST, 'invalid-stale-value');
    assert.equal(readActiveDuelId(HOST), null);
    assert.equal(readActiveDuelId('not-a-user'), null);
    forgetActiveDuelId('not-a-user', DUEL);
    assert.equal(entries.size, 1);
  });
});

test('Safari storage errors fail closed without interrupting the race UI', () => {
  const previous = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem() { throw new Error('Storage denied'); },
      setItem() { throw new Error('Storage denied'); },
      removeItem() { throw new Error('Storage denied'); },
    },
  };
  try {
    assert.doesNotThrow(() => rememberActiveDuelId(HOST, DUEL));
    assert.equal(readActiveDuelId(HOST), null);
    assert.doesNotThrow(() => forgetActiveDuelId(HOST, DUEL));
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
