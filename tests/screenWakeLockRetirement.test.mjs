import test from 'node:test';
import assert from 'node:assert/strict';
import {keepScreenAwake} from '../src/lib/screenWakeLock.ts';
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function handle(released=false){
 const listeners=new Set();
 return {released, listeners, calls:0,
  addEventListener(_type,cb){listeners.add(cb);},
  removeEventListener(_type,cb){listeners.delete(cb);},
  async release(){this.calls++;this.released=true;for(const cb of [...listeners])cb();}
 };
}
function harness(){
 let visible=true,listener;
 const requests=[],statuses=[];
 return {requests,statuses,source:{
  isSupported:()=>true,isVisible:()=>visible,
  request:()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),
  subscribeVisibility(cb){listener=cb;return()=>{listener=undefined;};}
 },setVisible(value){visible=value;listener?.();}};
}
test('already-released sentinel is never reported held',async()=>{
 const h=harness();const stop=keepScreenAwake(h.source,s=>h.statuses.push(s));
 h.requests[0].resolve(handle(true));await settle();
 assert.deepEqual(h.statuses,['requesting','released']);stop();
});
test('a late background rejection cannot overwrite hidden status',async()=>{
 const h=harness();const stop=keepScreenAwake(h.source,s=>h.statuses.push(s));
 h.setVisible(false);h.requests[0].reject(Error('hidden'));await settle();
 assert.equal(h.statuses.at(-1),'hidden');stop();
});
test('a request crossing background and foreground is retired and replaced',async()=>{
 const h=harness();const stop=keepScreenAwake(h.source,s=>h.statuses.push(s));
 h.setVisible(false);h.setVisible(true);
 const old=handle();h.requests[0].resolve(old);await settle();
 assert.equal(old.calls,1);assert.equal(h.requests.length,2);
 assert.equal(h.statuses.includes('held'),false);
 const fresh=handle();h.requests[1].resolve(fresh);await settle();
 assert.equal(h.statuses.at(-1),'held');stop();assert.equal(fresh.calls,1);
});
test('a queued release callback from an old sentinel cannot clear the new lock',async()=>{
 const h=harness();const stop=keepScreenAwake(h.source,s=>h.statuses.push(s));
 const old=handle();h.requests[0].resolve(old);await settle();
 const stale=[...old.listeners][0];h.setVisible(false);h.setVisible(true);
 const fresh=handle();h.requests[1].resolve(fresh);await settle();
 stale();assert.equal(h.statuses.at(-1),'held');
 h.setVisible(true);assert.equal(h.requests.length,2);
 stop();assert.equal(fresh.calls,1);
});
test('a pending request that finishes after teardown is released without reporting held',async()=>{
 const h=harness();const stop=keepScreenAwake(h.source,s=>h.statuses.push(s));
 stop();const old=handle();h.requests[0].resolve(old);await settle();
 assert.equal(old.calls,1);assert.deepEqual(h.statuses,['requesting']);
});
