import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePendingFinish, rememberPendingFinish, readPendingFinish, forgetPendingFinish } from '../src/lib/pendingDuelFinish.ts';
const userId='00000000-0000-4000-8000-000000000011';
const other='00000000-0000-4000-8000-000000000012';
const duelId='00000000-0000-4000-8000-000000000001';
const newer='00000000-0000-4000-8000-000000000002';
const startedAt=Date.now()-10000;
const payload={userId,duelId,startedAt,timeMs:6000,targetDistanceM:50,metrics:{stepsCount:25,raw:[1],metricsJson:{verification:'verified',latitude:30,motionRaw:[1],motionEvidence:'consistent',motionCoverage:.8}}};
test('only bounded identity/time and allowlisted aggregates survive reload',()=>{
 const p=parsePendingFinish(payload,userId,duelId);
 assert.equal(p.timeMs,6000); assert.equal(p.metrics.stepsCount,25);
 assert.deepEqual(p.metrics.metricsJson,{motionCoverage:.8,motionEvidence:'consistent',verification:'unverified'});
 assert.doesNotMatch(JSON.stringify(p),/latitude|motionRaw|"raw"/);
 for(const bad of [{...payload,timeMs:NaN},{...payload,timeMs:-1},{...payload,targetDistanceM:500},{...payload,startedAt:Date.now()-15000000},{...payload,startedAt:Date.now()+10000}])
   assert.equal(parsePendingFinish(bad,userId,duelId),null);
 assert.equal(parsePendingFinish(payload,other,duelId),null);
 assert.equal(parsePendingFinish(payload,userId,newer),null);
});
test('storage is account scoped, and a late cleanup cannot erase a newer finish',()=>{
 const store=new Map();
 globalThis.window={localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}};
 try {
  assert.equal(rememberPendingFinish(payload),true);
  assert.equal(readPendingFinish(userId,duelId).timeMs,6000);
  assert.equal(readPendingFinish(other,duelId),null);
  assert.equal(rememberPendingFinish({...payload,duelId:newer}),true);
  forgetPendingFinish(userId,duelId);
  assert.equal(readPendingFinish(userId,newer).timeMs,6000);
  forgetPendingFinish(userId,newer); assert.equal(readPendingFinish(userId,newer),null);
 } finally { delete globalThis.window; }
});
test('private browsing / unavailable storage falls back safely',()=>{
 globalThis.window={get localStorage(){throw Error('denied')}};
 try {assert.equal(rememberPendingFinish(payload),false);assert.equal(readPendingFinish(userId,duelId),null);assert.doesNotThrow(()=>forgetPendingFinish(userId,duelId));}
 finally { delete globalThis.window; }
});
test('integration saves before RPC, restores only matched server context and guards duplicate submissions',()=>{
 const s=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 assert.match(s,/rememberPendingFinish\(payload\);\s*void sendFinishedTime\(payload\)/);
 assert.match(s,/serverStart === pending.startedAt/);
 assert.match(s,/sessionData.session\?\.user.id !== payload.userId/);
 assert.match(s,/if \(finishSubmittingRef.current \|\|/);
 assert.match(s,/forgetPendingFinish\(authUser.id, row.id\)/);
});
