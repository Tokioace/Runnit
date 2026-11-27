import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
const regional=map.slice(map.indexOf('// A regional view'),map.indexOf('// Fetch only this authenticated host'));
test('regional discovery serializes polls and prioritizes visible reconnect',()=>{
  assert.match(regional,/createDuelRecoveryQueue\(async \(\) => \{/);
  assert.match(regional,/const whenRegionalVisible = \(\) => \{\s*if \(document.visibilityState === 'visible'\) regionalQueue.request\(\);/);
  assert.match(regional,/setInterval\(\(\) => \{\s*if \(document.visibilityState === 'visible'\) regionalQueue.poll\(\);\s*\}, 90_000\)/);
  for(const event of ['visibilitychange','online']){
    assert.ok(regional.includes("addEventListener('"+event+"', whenRegionalVisible)"));
    assert.ok(regional.includes("removeEventListener('"+event+"', whenRegionalVisible)"));
  }
  assert.match(regional,/active = false;\s*regionalQueue.close\(\);\s*window.clearInterval\(id\)/);
});
test('regional responses cannot restore expired events or publish to retired accounts',()=>{
  assert.match(regional,/if \(!active \|\| error\) return;\s*if \(finishAccountRef.current !== authUser.id\) return;/);
  assert.match(regional,/if \(knownNonOpenRunIdsRef.current.has\(row.id\)\) return \[\];\s*if \(!isOpenEventAvailable\(row.expires_at\)\) return \[\];/);
});

test('websocket resubscription refreshes only the currently active visible regional view',()=>{
  const realtime=map.slice(map.indexOf('// No Realtime subscription'),map.indexOf('// The server is the authority for expiration'));
  assert.match(map,/const requestRegionalDiscoveryRef = useRef<\(\(\) => void\) \| null>\(null\)/);
  assert.match(regional,/if \(!authUser \|\| !wideMapView\) \{\s*setRegionalRuns\(\[\]\);\s*return;/);
  assert.match(regional,/requestRegionalDiscoveryRef.current = whenRegionalVisible;\s*regionalQueue.request\(\);/);
  assert.match(regional,/if \(requestRegionalDiscoveryRef.current === whenRegionalVisible\) \{\s*requestRegionalDiscoveryRef.current = null;/);
  assert.match(realtime,/\.subscribe\(status => \{\s*if \(!lifetime.isActive\(\) \|\| finishAccountRef.current !== authUser.id\) return;[\s\S]*?if \(status === 'SUBSCRIBED'\) requestRegionalDiscoveryRef.current\?\.\(\);/);
});
