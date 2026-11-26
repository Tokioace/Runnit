import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
test('confirmed completion retires matched transitions even before the result is closed',()=>{
 const completed=map.slice(map.indexOf('const showCompletedDuel ='),map.indexOf('const closeCompletedDuel ='));
 const matched=map.slice(map.indexOf('const applyMatchedDuel ='),map.indexOf('// Display only profile nicknames'));
 assert.match(completed,/completedDuelIdsRef.current.add\(row.id\);[\s\S]*setRace\(/);
 assert.match(matched,/endedDuelIdsRef.current.has\(row.id\) \|\| completedDuelIdsRef.current.has\(row.id\)/);
 assert.ok(matched.indexOf('completedDuelIdsRef.current.has(row.id)')<matched.indexOf('activeDuelIdRef.current = row.id'));
});
test('Ready checks account, active duel and terminal state before and after the RPC',()=>{
 const ready=map.slice(map.indexOf('const confirmMatchReady ='),map.indexOf('// Joining and starting races'));
 assert.match(ready,/finishAccountRef.current === authUser.id &&\s*activeDuelIdRef.current === matchedDuel.id &&\s*!endedDuelIdsRef.current.has\(matchedDuel.id\) &&\s*!completedDuelIdsRef.current.has\(matchedDuel.id\)/);
 assert.match(ready,/if \(!stillCurrent\(\)\) return;[\s\S]*await readyForDuel\(supabase, matchedDuel.id\);\s*if \(!stillCurrent\(\)\) return;/);
 assert.match(ready,/if \(stillCurrent\(\)\) setReadyError/);
});
test('Ready shares the local write gate and always releases it',()=>{
 const ready=map.slice(map.indexOf('const confirmMatchReady ='),map.indexOf('// Joining and starting races'));
 assert.match(ready,/duelWriteGate.current.tryAcquire\(matchedDuel.id\);\s*if \(!releaseWrite\) return;/);
 assert.match(ready,/finally \{\s*releaseWrite\(\);/);
});
