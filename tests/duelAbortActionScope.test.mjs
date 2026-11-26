import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
const abort=source.slice(source.indexOf('const confirmAbortMatchedDuel ='),source.indexOf('const confirmMatchReady ='));

test('abort rejects retired accounts, other duels and terminal states before acquiring the write gate',()=>{
 assert.match(abort,/const stillCurrent = \(\) => finishAccountRef.current === authUser.id &&\s*activeDuelIdRef.current === duelId &&\s*!endedDuelIdsRef.current.has\(duelId\) &&\s*!completedDuelIdsRef.current.has\(duelId\);/);
 assert.match(abort,/if \(!stillCurrent\(\)\) throw new Error\([^)]*\);\s*const releaseWrite = duelWriteGate.current.tryAcquire\(duelId\);/);
 assert.ok(abort.indexOf('if (!stillCurrent())')<abort.indexOf('await abortMatchedDuel'));
});
test('late successful abort cannot clear an obsolete or completed duel',()=>{
 assert.match(abort,/await abortMatchedDuel\(supabase, duelId\);\s*if \(finishAccountRef.current !== authUser.id\) return;\s*if \(!stillCurrent\(\)\) return;/);
 assert.match(abort,/if \(confirmed.id !== duelId \|\| confirmed.status !== 'abandoned'\)/);
 assert.ok(abort.indexOf('if (!stillCurrent()) return;')<abort.indexOf('clearAbortedDuel(duelId, false)'));
});
test('late errors are ignored only for retired duels and the write gate always releases',()=>{
 assert.match(abort,/catch \(error\) \{[\s\S]*?if \(stillCurrent\(\)\) throw error;\s*\} finally \{\s*releaseWrite\(\);/);
});
