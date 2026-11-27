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

test('expired or confirmed non-open events cannot open or submit a stale cancellation dialog',()=>{
  const open=map.slice(map.indexOf('const handleCancelHostedRun ='),map.indexOf('const confirmCancelHostedRun ='));
  assert.match(open,/if \(knownNonOpenRunIdsRef.current.has\(run.id\) \|\|\s*\(run.expiresAt && !isOpenEventAvailable\(run.expiresAt\)\)\) return;/);
  assert.match(confirm,/if \(knownNonOpenRunIdsRef.current.has\(run.id\) \|\|\s*\(run.expiresAt && !isOpenEventAvailable\(run.expiresAt\)\)\) \{\s*setCancelConfirmation\(previous => previous\?\.id === run.id \? null : previous\);\s*return;\s*\}\s*setCancellingRunId\(run.id\);/);
});
test('realtime and local expiry retire only stale dialogs without interrupting a pending local cancellation',()=>{
  assert.match(map,/if \(payload.eventType === 'DELETE' \|\| row.status !== 'open' \|\|\s*\(typeof row.expires_at === 'string' && !isOpenEventAvailable\(row.expires_at\)\)\) \{\s*setCancelConfirmation\(previous => previous\?\.id === row.id \? null : previous\);/);
  assert.match(map,/if \(!cancelHostedPendingRef.current\) \{\s*setCancelConfirmation\(previous => previous\?\.expiresAt &&\s*!isOpenEventAvailable\(previous.expiresAt, now\) \? null : previous\);/);
});

test('cancel readback requires a successful response for the exact owned event',()=>{
  assert.match(confirm,/const \{ data: latest, error: readbackError \} = await supabase.from\('duels'\)[\s\S]*?\.eq\('id', run.id\).eq\('host_user_id', authUser.id\).maybeSingle\(\);/);
  assert.match(confirm,/if \(finishAccountRef.current !== authUser.id\) return;\s*if \(readbackError\) throw readbackError;\s*if \(latest && \(latest.id !== run.id \|\| latest.host_user_id !== authUser.id\)\) \{\s*throw new Error\([^\n]+\);\s*\}\s*if \(latest\?\.status === 'matched'\)/);
  assert.match(confirm,/else if \(latest && latest.status !== 'open'\) \{[\s\S]*?setRaceNotice\(latest.status === 'cancelled'\s*\? 'Dein Rennen ist laut Server abgesagt.'\s*: 'Dieses Rennen ist nicht mehr offen und wurde von der Karte entfernt.'\);/);
});
