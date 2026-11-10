import test from 'node:test';
import assert from 'node:assert/strict';
import { keepScreenAwake, screenWakeLockMessage } from '../src/lib/screenWakeLock.ts';

const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

function harness({ supported = true, visible = true, fail = false } = {}) {
  let isVisible = visible;
  let listener;
  let active = null;
  let requests = 0;
  let releases = 0;
  const statuses = [];
  const source = {
    isSupported: () => supported,
    isVisible: () => isVisible,
    subscribeVisibility: callback => {
      listener = callback;
      return () => { listener = null; };
    },
    request: async () => {
      requests++;
      if (fail) throw new Error('denied');
      const callbacks = new Set();
      const lock = {
        released: false,
        addEventListener: (_type, callback) => callbacks.add(callback),
        removeEventListener: (_type, callback) => callbacks.delete(callback),
        release: async () => {
          if (lock.released) return;
          lock.released = true;
          releases++;
          for (const callback of callbacks) callback();
        },
      };
      active = lock;
      return lock;
    },
  };
  return {
    source, statuses, get requests() { return requests; }, get releases() { return releases; },
    get active() { return active; },
    setVisible: value => { isVisible = value; listener?.(); },
    listen: status => statuses.push(status),
  };
}

test('acquires a wake lock, releases it on cleanup, never starts again', async () => {
  const h = harness();
  const stop = keepScreenAwake(h.source, h.listen);
  await settle();
  assert.equal(h.statuses.at(-1), 'held');
  assert.equal(h.requests, 1);
  stop();
  await settle();
  assert.equal(h.releases, 1);
  h.setVisible(false);
  h.setVisible(true);
  await settle();
  assert.equal(h.requests, 1);
});

test('reacquires after backgrounding and system releases the old lock', async () => {
  const h = harness();
  const stop = keepScreenAwake(h.source, h.listen);
  await settle();
  h.setVisible(false);
  await h.active.release();
  assert.equal(h.statuses.at(-1), 'hidden');
  h.setVisible(true);
  await settle();
  assert.equal(h.requests, 2);
  assert.equal(h.statuses.at(-1), 'held');
  stop();
});

test('unsupported and denied wake locks are visible, not silently treated as held', async () => {
  const unsupported = harness({ supported: false });
  keepScreenAwake(unsupported.source, unsupported.listen)();
  assert.deepEqual(unsupported.statuses, ['unsupported']);
  assert.equal(unsupported.requests, 0);

  const denied = harness({ fail: true });
  const stop = keepScreenAwake(denied.source, denied.listen);
  await settle();
  assert.equal(denied.statuses.at(-1), 'blocked');
  assert.equal(denied.requests, 1);
  // A denial does not cause an infinite retry loop.
  await settle();
  assert.equal(denied.requests, 1);
  stop();
});

test('locked display is never falsely claimed as background measurement support', () => {
  assert.match(screenWakeLockMessage('held'), /nicht mit der Seitentaste sperren/);
  assert.match(screenWakeLockMessage('hidden'), /Messung möglicherweise unterbrochen/);
});
