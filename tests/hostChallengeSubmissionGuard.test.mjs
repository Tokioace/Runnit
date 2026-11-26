import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
test('host dialog acquires a synchronous submission guard before rendering the busy state',()=>{
 const dialog=map.slice(map.indexOf('function HostRunDialog('),map.indexOf('// Authentication modal'));
 assert.match(dialog,/const submittingRef = useRef\(false\);/);
 assert.match(dialog,/const submitHost = async \(\) => \{\s*if \(submittingRef.current\) return;\s*submittingRef.current = true;\s*setSubmitting\(true\);/);
 assert.match(dialog,/await onHost\(distance\);\s*onClose\(\);/);
 assert.match(dialog,/finally \{\s*submittingRef.current = false;\s*setSubmitting\(false\);/);
});
test('host creation checks the account before preflight and after each network boundary',()=>{
 const host=map.slice(map.indexOf('const handleHostRun ='),map.indexOf('const handleCancelHostedRun ='));
 assert.match(host,/if \(!authUser \|\| finishAccountRef.current !== authUser.id\) \{/);
 assert.match(host,/\.limit\(1\);\s*if \(finishAccountRef.current !== authUser.id\) return;\s*if \(activeCheckError\)/);
 assert.match(host,/targetDistanceM: distanceMeters,\s*\}\);\s*if \(finishAccountRef.current !== authUser.id\) return;/);
});
test('latest GPS radius is rechecked after successful preflight before inserting the event',()=>{
 const host=map.slice(map.indexOf('const handleHostRun ='),map.indexOf('const handleCancelHostedRun ='));
 assert.match(host,/const latestCoords = liveUserCoordsRef.current;\s*if \(!latestCoords \|\| !canHostAt\(latestCoords, hostLocation\)\) \{[\s\S]*?throw new Error\([^)]*\);\s*\}\s*const \{ data, error \} = await createDuel/);
 assert.ok(host.indexOf('if (activeHosted?.length)')<host.indexOf('const latestCoords'));
 assert.match(map,/liveUserCoordsRef.current = userCoords;/);
});
