import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDuelStartLatch} from '../src/lib/duelStartLatch.ts';

test('old lobby rows cannot reset a server-confirmed start',()=>{
 const latch=createDuelStartLatch();
 assert.equal(latch.accept('a',null),true);
 assert.equal(latch.accept('a','2026-11-26T16:00:00Z'),true);
 assert.equal(latch.accept('a',null),false);
 assert.equal(latch.accept('a','2026-11-26T16:00:01Z'),false);
 assert.equal(latch.accept('a','2026-11-26T17:00:00+01:00'),true);
});
test('invalid starts do not poison a duel and different duels are independent',()=>{
 const latch=createDuelStartLatch();
 assert.equal(latch.accept('a','invalid'),false);
 assert.equal(latch.accept('a',null),true);
 assert.equal(latch.accept('a','2026-11-26T16:00:00Z'),true);
 assert.equal(latch.accept('b',null),true);
 assert.equal(latch.accept('b','2026-11-26T16:01:00Z'),true);
 assert.equal(latch.accept('a',null),false);
});
test('shared matched transition rejects stale snapshots before changing local race state',()=>{
 const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('const applyMatchedDuel ='),source.indexOf('// Display only profile nicknames'));
 assert.match(block,/if \(!duelStartLatch.current.accept\(row.id, startAt\)\) return;/);
 assert.ok(block.indexOf('duelStartLatch.current.accept')<block.indexOf('activeDuelIdRef.current = row.id'));
 assert.match(block,/const key = row.id \+ ':' \+ serverStart;/);
});

test('a scheduled start requires two distinct participants and both literal Ready acknowledgements',()=>{
 const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('const applyMatchedDuel ='),source.indexOf('// Display only profile nicknames'));
 const start=block.indexOf('// A matched race requires two distinct participants');
 const end=block.indexOf('// Once a server start is observed',start);
 assert.ok(start>=0&&end>start);
 const guard=new Function('row',block.slice(start,end)+'return true;');
 const valid={host_user_id:'host',challenger_user_id:'rival',host_ready:true,challenger_ready:true,start_at:'2026-11-27T19:00:00Z'};
 assert.equal(guard(valid),true);
 assert.equal(guard({...valid,start_at:null,host_ready:false,challenger_ready:false}),true);
 assert.equal(guard({...valid,start_at:null,host_ready:true,challenger_ready:false}),true);
 for(const key of ['host_ready','challenger_ready']){
  for(const value of [false,undefined,null,1,'true'])assert.equal(guard({...valid,[key]:value}),undefined);
 }
 for(const row of [{...valid,host_user_id:'rival'},{...valid,host_user_id:null},{...valid,challenger_user_id:''},{...valid,challenger_user_id:42},{...valid,start_at:undefined},{...valid,start_at:42},{...valid,start_at:{}}])assert.equal(guard(row),undefined);
 assert.ok(end<block.indexOf('duelStartLatch.current.accept'));
 assert.ok(end<block.indexOf('activeDuelIdRef.current = row.id'));
});
