import test from 'node:test';
import assert from 'node:assert/strict';
import { keepScreenAwake } from '../src/lib/screenWakeLock.ts';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

function deferredLockSource() {
  let visible = true;
  let visibilityListener = null;
  const pending = [];
  const locks = [];
  let unsubscribed = false;
  const source = {
    isSupported: () => true,
    isVisible: () => visible,
    subscribeVisibility(listener) {
      visibilityListener = listener;
      return () => { unsubscribed = true; visibilityListener = null; };
    },
    request() {
      return new Promise(resolve => pending.push(resolve));
    },
  };
  const grant = async () => {
    const listeners = new Set();
    const lock = {
      released: false,
      releaseCount: 0,
      addEventListener(_type, listener) { listeners.add(listener); },
      removeEventListener(_type, listener) { listeners.delete(listener); },
      async release() {
        this.releaseCount++;
        this.released = true;
        for (const listener of listeners) listener();
      },
    };
    locks.push(lock);
    assert.ok(pending.length, 'a wake-lock request must be pending');
    pending.shift()(lock);
    await flush();
    return lock;
  };
  return {
    source, pending, locks, grant,
    setVisible(value) { visible = value; visibilityListener?.(); },
    get unsubscribed() { return unsubscribed; },
  };
}

test('pending permission request resolving after teardown releases lock without reporting held', async () => {
  const h = deferredLockSource();
  const statuses = [];
  const stop = keepScreenAwake(h.source, status => statuses.push(status));
  assert.deepEqual(statuses, ['requesting']);
  stop();
  assert.equal(h.unsubscribed, true);
  const lock = await h.grant();
  assert.equal(lock.releaseCount, 1);
  assert.deepEqual(statuses, ['requesting']);
  h.setVisible(false);
  h.setVisible(true);
  assert.equal(h.pending.length, 0);
});

test('pending request granted while hidden is discarded; foreground gets one fresh lock', async () => {
  const h = deferredLockSource();
  const statuses = [];
  const stop = keepScreenAwake(h.source, status => statuses.push(status));
  h.setVisible(false);
  assert.equal(statuses.at(-1), 'hidden');
  const oldLock = await h.grant();
  assert.equal(oldLock.releaseCount, 1);
  assert.equal(statuses.at(-1), 'hidden');
  h.setVisible(true);
  assert.equal(h.pending.length, 1);
  const newLock = await h.grant();
  assert.equal(newLock.released, false);
  assert.equal(statuses.at(-1), 'held');
  stop();
  await flush();
  assert.equal(newLock.releaseCount, 1);
});

test('repeated visibility events during pending acquisition never create parallel requests', async () => {
  const h = deferredLockSource();
  const stop = keepScreenAwake(h.source, () => {});
  h.setVisible(true);
  h.setVisible(true);
  assert.equal(h.pending.length, 1);
  const lock = await h.grant();
  assert.equal(h.pending.length, 0);
  assert.equal(lock.released, false);
  stop();
  await flush();
  assert.equal(lock.releaseCount, 1);
});
