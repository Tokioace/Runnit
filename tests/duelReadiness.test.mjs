import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeDuelReadiness} from '../src/lib/duelReadiness.ts';
const base={id:'a',hostUserId:'host',challengerUserId:'rival',hostReady:false,challengerReady:false,startAt:null,targetDistanceM:50};
test('late Ready snapshots preserve both independently confirmed acknowledgements',()=>{
 let current=mergeDuelReadiness(null,{...base,hostReady:true});
 current=mergeDuelReadiness(current,{...base,challengerReady:true});
 assert.equal(current.hostReady,true);
 assert.equal(current.challengerReady,true);
 assert.deepEqual(mergeDuelReadiness(current,base),current);
 assert.equal(base.hostReady,false);
});
test('readiness never transfers to another duel or a changed participant pair',()=>{
 const ready={...base,hostReady:true,challengerReady:true};
 for(const next of [{...base,id:'b'},{...base,hostUserId:'other'},{...base,challengerUserId:'other'}]){
  assert.deepEqual(mergeDuelReadiness(ready,next),next);
 }
});
test('only readiness is preserved, while new snapshot fields remain authoritative',()=>{
 const next={...base,targetDistanceM:75,startAt:'2026-11-26T16:10:00Z'};
 assert.deepEqual(mergeDuelReadiness({...base,hostReady:true},next),{...next,hostReady:true});
});
test('MapScreen merges both lobby transitions against the latest React state',()=>{
 const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('const applyMatchedDuel ='),source.indexOf('// Display only profile nicknames'));
 assert.equal((block.match(/setMatchedDuel\(previous => mergeDuelReadiness\(previous, \{/g)||[]).length,2);
 const merges=[...block.matchAll(/setMatchedDuel\(previous => mergeDuelReadiness\(previous, \{([\s\S]*?)\}\)\);/g)];
 assert.equal(merges.length,2);
 for(const merge of merges) assert.match(merge[1],/hostReady: row.host_ready === true, challengerReady: row.challenger_ready === true/);
 const savedLobby=block.match(/setMatchOverlay\(\{ duelId: row.id, startsAt, targetDistanceM, lobby: \{([\s\S]*?)\} \}\);/);
 assert.ok(savedLobby,'countdown must retain its confirmed lobby');
 assert.match(savedLobby[1],/id: row.id, hostUserId: row.host_user_id, challengerUserId: row.challenger_user_id/);
 assert.match(savedLobby[1],/hostReady: row.host_ready === true, challengerReady: row.challenger_ready === true, startAt/);
});

test('Ready acknowledgement must confirm the same participants and the requesting runner',()=>{
 const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('const confirmMatchReady ='),source.indexOf('// Joining and starting races'));
 const start=block.indexOf('if (data.host_user_id !== matchedDuel.hostUserId');
 const end=block.indexOf('applyMatchedDuel(data);',start);
 assert.ok(start>=0&&end>start);
 const check=new Function('data','matchedDuel','authUser',block.slice(start,end)+'return true;');
 const valid={id:'a',status:'matched',host_user_id:'host',challenger_user_id:'rival',host_ready:true,challenger_ready:true};
 assert.equal(check({...valid,challenger_ready:false},base,{id:'host'}),true);
 assert.equal(check({...valid,host_ready:false},base,{id:'rival'}),true);
 for(const actor of ['host','rival']){
  const flag=actor==='host'?'host_ready':'challenger_ready';
  for(const value of [false,null,undefined,'true',1]) assert.throws(()=>check({...valid,[flag]:value},base,{id:actor}),/eigene Bereitschaft nicht eindeutig bestätigt/);
  for(const row of [{...valid,host_user_id:'other'},{...valid,challenger_user_id:'other'},{...valid,host_user_id:'rival',challenger_user_id:'host'}]){
   assert.throws(()=>check(row,base,{id:actor}),/eigene Bereitschaft nicht eindeutig bestätigt/);
  }
 }
 assert.match(block,/catch \{[\s\S]*?if \(stillCurrent\(\)\) requestMatchRecoveryRef.current\?\.\(\);/);
 assert.match(block,/finally \{\s*releaseWrite\(\);/);
});
