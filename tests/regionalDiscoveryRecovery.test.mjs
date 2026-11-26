import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
const regional=map.slice(map.indexOf('// A regional view'),map.indexOf('// Fetch only this authenticated host'));
test('regional discovery serializes polls and prioritizes visible reconnect',()=>{
  assert.match(regional,/createDuelRecoveryQueue\(async \(\) => \{/);
  assert.match(regional,/const whenVisible = \(\) => \{\s*if \(document.visibilityState === 'visible'\) queue.request\(\);/);
  assert.match(regional,/setInterval\(\(\) => \{\s*if \(document.visibilityState === 'visible'\) queue.poll\(\);\s*\}, 90_000\)/);
  for(const event of ['visibilitychange','online']){
    assert.ok(regional.includes("addEventListener('"+event+"', whenVisible)"));
    assert.ok(regional.includes("removeEventListener('"+event+"', whenVisible)"));
  }
  assert.match(regional,/active = false;\s*queue.close\(\);\s*window.clearInterval\(id\)/);
});
test('regional responses cannot restore expired events or publish to retired accounts',()=>{
  assert.match(regional,/if \(!active \|\| error\) return;\s*if \(finishAccountRef.current !== authUser.id\) return;/);
  assert.match(regional,/if \(knownNonOpenRunIdsRef.current.has\(row.id\)\) return \[\];\s*if \(!isOpenEventAvailable\(row.expires_at\)\) return \[\];/);
});
