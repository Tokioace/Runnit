import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDuelWriteGate} from '../src/lib/duelWriteGate.ts';

test('finish and abort cannot acquire the same duel concurrently',async()=>{
 const gate=createDuelWriteGate();
 let resolve;
 const release=gate.tryAcquire('duel');
 assert.ok(release);
 const pending=new Promise(r=>{resolve=r;}).finally(release);
 assert.equal(gate.tryAcquire('duel'),null);
 const different=gate.tryAcquire('other');
 assert.ok(different);different();
 resolve();await pending;
 const abort=gate.tryAcquire('duel');
 assert.ok(abort);
 assert.equal(gate.tryAcquire('duel'),null);
 abort();assert.ok(gate.tryAcquire('duel'));
});
test('failed operation releases the gate and a stale release cannot unlock its successor',async()=>{
 const gate=createDuelWriteGate();
 const first=gate.tryAcquire('duel');
 await assert.rejects(Promise.reject(Error('offline')).finally(first),/offline/);
 const second=gate.tryAcquire('duel');
 assert.ok(second);
 first();
 assert.equal(gate.tryAcquire('duel'),null);
 second();assert.ok(gate.tryAcquire('duel'));
});
test('MapScreen uses one gate for both automatic or retried finish writes and aborts',()=>{
 const s=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const send=s.slice(s.indexOf('const sendFinishedTime ='),s.indexOf('const retryFinishedTime ='));
 const abort=s.slice(s.indexOf('const confirmAbortMatchedDuel ='),s.indexOf('const confirmMatchReady ='));
 assert.match(send,/duelWriteGate.current.tryAcquire\(payload.duelId\);\s*if \(!releaseWrite\) return;/);
 assert.match(send,/finally \{[\s\S]*releaseWrite\(\);/);
 assert.match(abort,/duelWriteGate.current.tryAcquire\(duelId\);\s*if \(!releaseWrite\) throw/);
 assert.match(abort,/finally \{\s*releaseWrite\(\);/);
 assert.ok(send.indexOf('tryAcquire')<send.indexOf('await submitDuelResult'));
 assert.ok(abort.indexOf('tryAcquire')<abort.indexOf('await abortMatchedDuel'));
});
