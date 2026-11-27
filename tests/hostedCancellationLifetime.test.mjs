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
  const initial=map.slice(map.indexOf('// Fetch only this authenticated host'),map.indexOf('// Mobile Safari may suspend Realtime'));
  assert.match(initial,/\.catch\(\(\) => \{\s*if \(!hostedReadCurrent\(\)\) return;\s*setHostedDuelsLoadError\(true\);/);
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

test('older hosted snapshots cannot overwrite confirmed local creations',()=>{
  const initial=map.slice(map.indexOf('// Fetch only this authenticated host'),map.indexOf('// Mobile Safari may suspend Realtime'));
  const host=map.slice(map.indexOf('const handleHostRun ='),map.indexOf('const handleCancelHostedRun ='));
  assert.match(map,/const hostedCreationRevisionRef = useRef\(0\)/);
  assert.match(host,/hostedCreationRevisionRef.current \+= 1;\s*setOpenRuns\(previous => \[created/);
  assert.ok(host.indexOf('hostedCreationRevisionRef.current += 1;')>host.indexOf('if (!isOpenEventAvailable(data.expires_at))'));
  assert.match(initial,/const hostedRevision = hostedCreationRevisionRef.current;\s*const hostedReadCurrent = \(\) => active && finishAccountRef.current === authUser.id &&\s*hostedCreationRevisionRef.current === hostedRevision;/);
  assert.match(initial,/\.then\(runs => \{\s*if \(!hostedReadCurrent\(\)\) return;/);
  assert.match(initial,/\.catch\(\(\) => \{\s*if \(!hostedReadCurrent\(\)\) return;/);
  assert.match(confirm,/requestHostedDiscoveryRef.current\?\.\(\);/);
  assert.doesNotMatch(confirm,/listHostedOpenDuels\(/);
});

test('owned event discovery retries after visible reconnect without overlapping queued reads',()=>{
  const initial=map.slice(map.indexOf('// Fetch only this authenticated host'),map.indexOf('// Mobile Safari may suspend Realtime'));
  assert.match(initial,/const hostedDiscoveryQueue = createDuelRecoveryQueue\(async \(\) => \{\s*const hostedRevision = hostedCreationRevisionRef.current;/);
  assert.match(initial,/await listHostedOpenDuels\(supabase, authUser.id\)/);
  assert.match(initial,/const whenHostedVisible = \(\) => \{\s*if \(document.visibilityState === 'visible'\) hostedDiscoveryQueue.request\(\);\s*\};\s*hostedDiscoveryQueue.request\(\);/);
  assert.match(initial,/document.addEventListener\('visibilitychange', whenHostedVisible\);/);
  assert.match(initial,/window.addEventListener\('online', whenHostedVisible\);/);
  assert.match(initial,/active = false;\s*hostedDiscoveryQueue.close\(\);\s*document.removeEventListener\('visibilitychange', whenHostedVisible\);\s*window.removeEventListener\('online', whenHostedVisible\);/);
});

test('cancellation and reconnect use the same hosted discovery queue with lifetime cleanup',()=>{
  const initial=map.slice(map.indexOf('// Fetch only this authenticated host'),map.indexOf('// Mobile Safari may suspend Realtime'));
  assert.match(map,/const requestHostedDiscoveryRef = useRef<\(\(\) => void\) \| null>\(null\)/);
  assert.match(initial,/requestHostedDiscoveryRef.current = hostedDiscoveryQueue.request;/);
  assert.match(initial,/if \(requestHostedDiscoveryRef.current === hostedDiscoveryQueue.request\) \{\s*requestHostedDiscoveryRef.current = null;/);
  assert.match(confirm,/else \{\s*\/\/ Share the lifecycle queue[^\n]*\n\s*\/\/[^\n]*\n\s*requestHostedDiscoveryRef.current\?\.\(\);/);
});
