import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
const confirm=map.slice(map.indexOf('const confirmCancelHostedRun ='),map.indexOf('const sendFinishedTime ='));
test('hosted cancellation claims synchronously before the first request and prevents duplicate submissions',()=>{
  assert.match(map,/const cancelHostedPendingRef = useRef\(false\)/);
  assert.match(confirm,/if \(cancelHostedPendingRef.current \|\| !authUser \|\| finishAccountRef.current !== authUser.id\) return;/);
  const claim=confirm.indexOf('cancelHostedPendingRef.current = true;');
  const request=confirm.indexOf('await cancelHostedOpenDuel');
  assert.ok(claim>=0 && request>claim);
  assert.match(map,/const handleCancelHostedRun = \(run: HostedOpenDuel\) => \{\s*if \(cancelHostedPendingRef.current/);
  assert.match(map,/if \(cancelHostedPendingRef.current\) return; setCancelConfirmation\(null\);/);
});
test('rejected status recovery reports an error only to the current account and releases the request lock',()=>{
  assert.match(confirm,/catch \{[\s\S]*?if \(finishAccountRef.current !== authUser.id \|\| knownNonOpenRunIdsRef.current.has\(run.id\)\) return;\s*const message = 'Rennstatus konnte nicht geprüft werden/);
  assert.match(confirm,/finally \{\s*cancelHostedPendingRef.current = false;\s*if \(finishAccountRef.current === authUser.id\) setCancellingRunId\(null\);/);
  assert.match(confirm,/\.catch\(\(\) => \{\s*if \(finishAccountRef.current === authUser.id\) setHostedDuelsLoadError\(true\);/);
});
