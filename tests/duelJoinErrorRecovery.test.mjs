import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyDuelJoinError} from '../src/lib/duelJoinError.ts';
test('structured PostgREST rejection messages are classified without instanceof Error',()=>{
 for(const message of ['Challenge expired or unavailable','Duel was already joined or expired','Duel not found']){
  assert.equal(classifyDuelJoinError({code:'23514',message}),'unavailable');
  assert.equal(classifyDuelJoinError(new Error(message)),'unavailable');
 }
 assert.equal(classifyDuelJoinError({code:'42501',message:'Host cannot join own duel'}),'permission');
 assert.equal(classifyDuelJoinError({code:'42501',message:'permission denied'}),'permission');
});
test('ambiguous transport failures do not imply an unavailable challenge',()=>{
 for(const error of [null,{},'Duel not found',new Error('Network unavailable'),{message:'Service unavailable',code:'503'},{code:'23514',message:'Unknown constraint'}]){
  assert.equal(classifyDuelJoinError(error),'unknown');
 }
});
test('join guards account lifetime and confirmed races before writing and after a rejected response',()=>{
 const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const join=map.slice(map.indexOf('const handleJoinRun ='),map.indexOf('// Both views use the exact same secure callbacks'));
 assert.match(join,/finishAccountRef.current !== authUser.id\) return;\s*if \(race.status !== 'idle'/);
 assert.match(join,/activeDuelIdRef.current !== unconfirmedRecoveryHintRef.current/);
 assert.match(join,/catch \(e\) \{[\s\S]*?finishAccountRef.current !== authUser.id \|\|[\s\S]*?endedDuelIdsRef.current.has\(run.id\) \|\| completedDuelIdsRef.current.has\(run.id\)[\s\S]*?return;\s*const kind = classifyDuelJoinError\(e\);/);
 assert.match(join,/if \(kind === 'unavailable'\) \{\s*setOpenRuns/);
 assert.match(join,/else \{\s*setDiscoveryRefreshTick\(tick => tick \+ 1\);\s*setRaceNotice\('Beitritt nicht bestätigt/);
 assert.match(join,/finally \{\s*joiningRunRef.current = null;/);
});

test('stale event click cannot request a join after confirmed closure or local expiry',()=>{
 const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const join=map.slice(map.indexOf('const handleJoinRun ='),map.indexOf('// Both views use the exact same secure callbacks'));
 const guard=join.indexOf('if (knownNonOpenRunIdsRef.current.has(run.id)');
 const request=join.indexOf('joiningRunRef.current = run.id;');
 assert.ok(guard>=0 && request>guard);
 const preflight=join.slice(guard,request);
 assert.match(preflight,/if \(knownNonOpenRunIdsRef.current.has\(run.id\) \|\|\s*\(run.expiresAt && !isOpenEventAvailable\(run.expiresAt\)\)\) \{/);
 assert.match(preflight,/setOpenRuns\(previous => previous.filter\(item => item.id !== run.id\)\)/);
 assert.match(preflight,/setHostedOpenDuels\(previous => previous.filter\(item => item.id !== run.id\)\)/);
 assert.match(preflight,/setRegionalRuns\(previous => previous.filter\(item => item.id !== run.id\)\)/);
 assert.match(preflight,/setSelectedRunId\(previous => previous === run.id \? null : previous\)/);
 assert.match(preflight,/setDiscoveryRefreshTick\(tick => tick \+ 1\);\s*setRaceNotice\([^\n]+\);\s*return;\s*\}/);
});

test('only an unavailable join rejection retires all discovery markers without retiring the duel itself',()=>{
 const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const join=map.slice(map.indexOf('const handleJoinRun ='),map.indexOf('// Both views use the exact same secure callbacks'));
 const unavailable=join.slice(join.indexOf("if (kind === 'unavailable')"),join.indexOf("} else if (kind === 'permission')"));
 assert.match(unavailable,/knownNonOpenRunIdsRef.current.add\(run.id\)/);
 assert.match(unavailable,/setRegionalRuns\(previous => previous.filter\(item => item.id !== run.id\)\)/);
 assert.match(unavailable,/setHostedOpenDuels\(previous => previous.filter\(item => item.id !== run.id\)\)/);
 assert.match(unavailable,/setSelectedRunId\(previous => previous === run.id \? null : previous\)/);
 assert.doesNotMatch(unavailable,/endedDuelIdsRef.current.add|completedDuelIdsRef.current.add|forgetActiveDuelId|forgetPendingFinish/);
 const other=join.slice(join.indexOf("} else if (kind === 'permission')"));
 assert.doesNotMatch(other,/knownNonOpenRunIdsRef.current.add|setRegionalRuns|setOpenRuns|setHostedOpenDuels/);
});
