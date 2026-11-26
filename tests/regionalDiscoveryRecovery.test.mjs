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
