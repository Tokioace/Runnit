import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');

test('matched realtime and join transitions cannot replace another active duel',()=>{
 const apply=map.slice(map.indexOf('const applyMatchedDuel ='),map.indexOf('// Display only profile nicknames'));
 assert.match(apply,/if \(activeDuelIdRef.current !== null && activeDuelIdRef.current !== row.id\) return;/);
 assert.ok(apply.indexOf('activeDuelIdRef.current !== row.id')<apply.indexOf('duelStartLatch.current.accept'));
 assert.ok(apply.indexOf('activeDuelIdRef.current !== row.id')<apply.indexOf('activeDuelIdRef.current = row.id'));
});
test('recovery checks the current duel when a different or retired matched row is returned',()=>{
 const recover=map.slice(map.indexOf('const queue = createDuelRecoveryQueue'),map.indexOf('const whenVisible ='));
 assert.match(recover,/if \(!current\(\) \|\| error\) return;\s*const activeBeforeRecovery = activeDuelIdRef.current;/);
 assert.match(recover,/if \(data && \(!activeBeforeRecovery \|\| data.id === activeBeforeRecovery\) &&\s*!endedDuelIdsRef.current.has\(data.id\) && !completedDuelIdsRef.current.has\(data.id\)\) \{\s*applyMatchedDuel\(data\);\s*(?:\/\/[^\n]*\n\s*)*if \(!current\(\)\) return;\s*\}/);
 assert.match(recover,/const activeId = activeDuelIdRef.current \|\| readActiveDuelId\(authUser.id\)/);
 assert.match(recover,/\.eq\('id', activeId\).maybeSingle\(\)/);
 assert.match(recover,/if \(!current\(\) \|\| statusError \|\| activeDuelIdRef.current !== activeId\) return;/);
 assert.match(recover,/if \(latest\?\.status === 'abandoned'\) \{\s*clearAbortedDuel\(activeId, true\);\s*\} else if \(latest\?\.status === 'completed'\) \{\s*showCompletedDuel\(latest\);/);
});
test('the completed overlay remains recoverable until the local close clears its active ID',()=>{
 const close=map.slice(map.indexOf('const closeCompletedDuel ='),map.indexOf('const applyMatchedDuel ='));
 assert.match(close,/endedDuelIdsRef.current.add\(duelId\);\s*if \(activeDuelIdRef.current === duelId\) activeDuelIdRef.current = null;/);
 assert.match(close,/forgetActiveDuelId\(authUser.id, duelId\)/);
});

test('a mismatched status row cannot retire or complete the active duel',()=>{
 const recover=map.slice(map.indexOf('const queue = createDuelRecoveryQueue'),map.indexOf('const whenVisible ='));
 assert.match(recover,/if \(!current\(\) \|\| statusError \|\| activeDuelIdRef.current !== activeId\) return;\s*\/\/[^\n]+\n\s*if \(latest && latest.id !== activeId\) return;/);
 const guard=recover.indexOf('if (latest && latest.id !== activeId) return;');
 assert.ok(guard>=0);
 for(const transition of ['canReleaseUnconfirmedDuelHint({','clearAbortedDuel(activeId, true)','showCompletedDuel(latest)','applyMatchedDuel(latest)']){
  assert.ok(recover.indexOf(transition)>guard);
 }
});
