import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {duelRealtimeRow,createDuelRealtimeLifetime} from '../src/lib/duelRealtime.ts';
const id='00000000-0000-4000-8000-000000000011',host='00000000-0000-4000-8000-000000000012',peer='00000000-0000-4000-8000-000000000013';
const event=(eventType,old={},next={})=>({schema:'public',table:'duels',eventType,old,new:next});
test('DELETE selects old primary key even when new is an empty object',()=>{
 assert.deepEqual(duelRealtimeRow(event('DELETE',{id,host_user_id:host,status:'matched'},{})),{id});
 assert.equal(duelRealtimeRow(event('DELETE',{}, {id})),null);
});
test('valid inserts and updates preserve race state and location',()=>{
 const row={id,host_user_id:host,status:'open',location:'POINT(9 48)'};
 assert.deepEqual(duelRealtimeRow(event('INSERT',{},row)),row);
 for(const status of ['matched','completed','abandoned','cancelled','expired']){
  const next={...row,status,challenger_user_id:peer};
  assert.deepEqual(duelRealtimeRow(event('UPDATE',{},next)),next);
 }
});
test('malformed or unrelated messages cannot trigger race UI transitions',()=>{
 const row={id,host_user_id:host,challenger_user_id:peer,status:'matched'};
 for(const bad of [null,[],event('UNKNOWN',{},row),{...event('UPDATE',{},row),table:'users'},{...event('UPDATE',{},row),schema:'private'},
   event('UPDATE',{},{}),event('UPDATE',{}, {...row,id:'fake'}),event('UPDATE',{}, {...row,status:'verified'}),
   event('UPDATE',{}, {...row,host_user_id:null}),event('UPDATE',{}, {...row,challenger_user_id:host}),event('UPDATE',{}, {...row,challenger_user_id:null})]){
  assert.equal(duelRealtimeRow(bad),null);
 }
});
test('retired callbacks are inert and replacement has independent lifetime',()=>{
 const first=createDuelRealtimeLifetime(),second=createDuelRealtimeLifetime();
 let deliveries=0;
 const queued=()=>{if(first.isActive())deliveries++;};
 queued();first.close();first.close();queued();
 assert.equal(deliveries,1);assert.equal(second.isActive(),true);
});
test('map closes callback lifetime before asynchronous removal and deletes markers only',()=>{
 const screen=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 assert.match(screen,/if \(!lifetime\.isActive\(\)\) return;\s*const row: any = duelRealtimeRow\(payload\)/);
 assert.match(screen,/lifetime\.close\(\);\s*void supabase\.removeChannel\(channel\)/);
 const block=screen.slice(screen.indexOf('// DELETE supplies only'),screen.indexOf('// A second browser/device'));
 assert.match(block,/setOpenRuns/);assert.match(block,/setHostedOpenDuels/);assert.match(block,/setRegionalRuns/);
 assert.doesNotMatch(block,/showCompletedDuel|clearAbortedDuel|applyMatchedDuel/);
 assert.match(screen,/if \(status === 'SUBSCRIBED'\) setDiscoveryRefreshTick/);
});

test('owned open events and websocket resubscription refresh the shared hosted list',()=>{
 const screen=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const realtime=screen.slice(screen.indexOf('// No Realtime subscription'),screen.indexOf('// The server is the authority for expiration'));
 assert.match(realtime,/if \(row.host_user_id === authUser.id && row.status === 'open' &&\s*payload.eventType !== 'DELETE' && row.challenger_user_id == null &&\s*typeof row.expires_at === 'string' && isOpenEventAvailable\(row.expires_at\)\) \{\s*hostedCreationRevisionRef.current \+= 1;\s*requestHostedDiscoveryRef.current\?\.\(\);/);
 assert.ok(realtime.indexOf('knownNonOpenRunIdsRef.current.has(row.id)')<realtime.indexOf('hostedCreationRevisionRef.current += 1;'));
 assert.match(realtime,/\.subscribe\(status => \{\s*if \(!lifetime.isActive\(\) \|\| finishAccountRef.current !== authUser.id\) return;[\s\S]*?if \(status === 'SUBSCRIBED'\) requestHostedDiscoveryRef.current\?\.\(\);/);
});
