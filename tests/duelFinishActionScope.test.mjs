import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');

test('finish retry is bound to the visible duel, not the most recent arbitrary payload',()=>{
 const retry=source.slice(source.indexOf('const retryFinishedTime ='),source.indexOf('const confirmAbortMatchedDuel ='));
 assert.match(retry,/async \(duelId: string\)/);
 assert.match(retry,/if \(payload\?\.duelId === duelId\) await sendFinishedTime\(payload\);/);
 assert.match(source,/onRetrySubmit=\{\(\) => retryFinishedTime\(race.duelId\)\}/);
});
test('finish writes require the current account, active duel and nonterminal payload before and after awaits',()=>{
 const send=source.slice(source.indexOf('const sendFinishedTime ='),source.indexOf('const retryFinishedTime ='));
 assert.match(send,/const stillCurrent = \(\) => finishAccountRef.current === payload.userId &&\s*latestFinishPayloadRef.current === payload &&\s*activeDuelIdRef.current === payload.duelId &&\s*!endedDuelIdsRef.current.has\(payload.duelId\) &&\s*!completedDuelIdsRef.current.has\(payload.duelId\);/);
 assert.match(send,/if \(finishSubmittingRef.current \|\| !stillCurrent\(\)\) return;\s*const releaseWrite/);
 assert.match(send,/await supabase.auth.getSession\(\);\s*if \(!stillCurrent\(\)\) return;/);
 assert.match(send,/await submitDuelResult\([^;]*\);\s*if \(!stillCurrent\(\)\) return;/);
 assert.match(send,/if \(stillCurrent\(\)\) setFinishSubmissionError/);
});
test('closing an obsolete result cannot clear the active race or its countdown state',()=>{
 const close=source.slice(source.indexOf('const closeCompletedDuel ='),source.indexOf('const applyMatchedDuel ='));
 assert.match(close,/if \(endedDuelIdsRef.current.has\(duelId\) \|\|\s*\(activeDuelIdRef.current !== null && activeDuelIdRef.current !== duelId\)\) return;\s*recoveryRevisionRef.current \+= 1;/);
 assert.match(close,/forgetActiveDuelId\(authUser.id, duelId\)/);
 assert.match(close,/forgetPendingFinish\(authUser.id, duelId\)/);
});

test('finish submission requests immediate read-only recovery only after attempting the write',()=>{
 const send=source.slice(source.indexOf('const sendFinishedTime ='),source.indexOf('const retryFinishedTime ='));
 assert.match(send,/let writeAttempted = false;\s*try \{/);
 assert.match(send,/writeAttempted = true;\s*const \{ error \} = await submitDuelResult\([^;]*\);\s*if \(!stillCurrent\(\)\) return;[\s\S]*?requestMatchRecoveryRef.current\?\.\(\);\s*if \(error\)/);
 assert.match(send,/if \(writeAttempted && stillCurrent\(\)\) requestMatchRecoveryRef.current\?\.\(\);\s*\} finally \{/);
 assert.equal((send.match(/await submitDuelResult\(/g)??[]).length,1);
 assert.doesNotMatch(send,/forgetPendingFinish\(|showCompletedDuel\(|clearAbortedDuel\(/);
});
