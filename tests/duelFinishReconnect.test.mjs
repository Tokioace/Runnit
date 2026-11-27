import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDuelResultRows} from '../src/lib/duelOutcome.ts';
import {createFinishRefresh} from '../src/lib/finishRefresh.ts';
const source=readFileSync(new URL('../src/components/race/DuelFinishScreen.tsx',import.meta.url),'utf8');
test('reconnect refreshes result reads immediately and unregisters with the screen',()=>{
 assert.match(source,/const onVisible = \(\) => \{ if \(document.visibilityState === 'visible'\) void refresh\(true\); \};/);
 assert.match(source,/window.addEventListener\('online', onVisible\);/);
 assert.match(source,/active = false;\s*request.close\(\);[\s\S]*?window.removeEventListener\('online', onVisible\);/);
});
test('a valid own result is authoritative, while contradictory results cannot suppress retry',()=>{
 const host='host',challenger='challenger';
 const mine={user_id:host,time_ms:8000};
 assert.deepEqual(validateDuelResultRows([mine],host,challenger),[mine]);
 assert.equal(validateDuelResultRows([mine,{...mine,time_ms:9000}],host,challenger),null);
 assert.match(source,/const uniqueResults = validatedResults \?\? \[\];/);
 assert.match(source,/const mine = uniqueResults.find\(row => row.user_id === userId\);/);
 assert.match(source,/const ownTimeConfirmed = status === 'matched' && mine !== undefined;/);
 assert.match(source,/if \(retryBusy \|\| completed \|\| terminalWithoutResult \|\| ownTimeConfirmed\) return;/);
 assert.match(source,/submissionError && !completed && !terminalWithoutResult && !ownTimeConfirmed/);
});
test('reconnecting during an outstanding result read never starts a second one',async()=>{
 let calls=0,release;
 const read=createFinishRefresh(()=>{calls++;return new Promise(resolve=>{release=resolve;});},()=>assert.fail('unexpected error'));
 const first=read.refresh();
 await read.refresh();
 assert.equal(calls,1);
 release();await first;
 const next=read.refresh();
 assert.equal(calls,2);
 read.close();release();await next;
 await read.refresh();assert.equal(calls,2);
});

test('finish retry and abort synchronously exclude one another before either async action',()=>{
 const retry=source.slice(source.indexOf('const retrySubmission ='),source.indexOf('const abort ='));
 const abort=source.slice(source.indexOf('const abort ='),source.indexOf('  return (',source.indexOf('const abort =')));
 assert.match(source,/const pendingActionRef = useRef<'retry' \| 'abort' \| null>\(null\)/);
 assert.match(retry,/if \(pendingActionRef.current !== null\) return;\s*pendingActionRef.current = 'retry';\s*setRetryBusy\(true\);\s*try \{ await onRetrySubmit\(\); \}/);
 assert.match(retry,/finally \{\s*pendingActionRef.current = null;\s*setRetryBusy\(false\);/);
 assert.match(abort,/if \(pendingActionRef.current !== null\) return;\s*pendingActionRef.current = 'abort';\s*setAbortBusy\(true\);/);
 assert.match(abort,/catch \{\s*pendingActionRef.current = null;\s*setAbortError/);
 assert.match(source,/void retrySubmission\(\); \}\} disabled=\{retryBusy \|\| abortBusy\}/);
 assert.match(source,/disabled=\{abortBusy \|\| retryBusy\} onClick=\{\(\) => \{ void abort\(\); \}\}/);
 assert.match(source,/disabled=\{retryBusy \|\| abortBusy\} onClick=\{\(\) => setConfirmAbort\(true\)\}/);
});
