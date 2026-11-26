import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ghostFixOrder} from '../src/lib/ghostGpsReadiness.ts';
import {isFreshStartFix} from '../src/lib/gpsField.ts';

test('field preparation cannot recover an older accurate anchor after a newer poor observation',()=>{
 const now=10000;
 const fix=(timestampMs,accuracyM=4)=>({latitude:48,longitude:9,timestampMs,accuracyM});
 const first=ghostFixOrder(null,fix(9000),now);
 assert.equal(isFreshStartFix(fix(9000),now),true);
 const poor=ghostFixOrder(first.timestampMs,fix(9500,25),now);
 assert.equal(isFreshStartFix(fix(9500,25),now),false);
 assert.equal(ghostFixOrder(poor.timestampMs,fix(9200),now).ignore,true);
 assert.equal(ghostFixOrder(poor.timestampMs,fix(9500),now).ignore,true);
 assert.equal(ghostFixOrder(poor.timestampMs,fix(9800),now).ignore,false);
 assert.equal(isFreshStartFix(fix(9800),now),true);
});
test('field preparation applies ordering before freshness and clears invalid start anchors',()=>{
 const source=readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx',import.meta.url),'utf8');
 const a=source.indexOf('watchId.current = navigator.geolocation.watchPosition('),b=source.indexOf('const previous = stateRef.current;',a);
 assert.ok(a>=0&&b>a);
 const prepare=source.slice(a,b);
 assert.ok(prepare.indexOf('ghostFixOrder(')>=0&&prepare.indexOf('ghostFixOrder(')<prepare.indexOf('if (!isFreshLiveGpsFix('));
 assert.match(prepare,/if \(order.ignore\) return;\s*latestPreparationFixMs.current = order.timestampMs;/);
 assert.match(prepare,/if \(!isFreshLiveGpsFix\(sample, now\)\) \{[\s\S]*?if \(preparing\) \{\s*readyFixRef.current = null;\s*setCurrentPhase\('acquiring'\);/);
 assert.match(prepare,/if \(isFreshStartFix\(sample, now\)\) \{[\s\S]*?\} else \{\s*readyFixRef.current = null;\s*setCurrentPhase\('acquiring'\);/);
});
test('field watch retirement clears the anchor and only a visible live watch can start',()=>{
 const source=readFileSync(new URL('../src/screens/GpsFieldTestScreen.tsx',import.meta.url),'utf8');
 const a=source.indexOf('const stopWatching ='),b=source.indexOf('useLayoutEffect(() =>',a);
 assert.ok(a>=0&&b>a);
 assert.match(source.slice(a,b),/watchLifetime.current.close\(\);\s*const id = watchId.current;\s*watchId.current = null;\s*latestPreparationFixMs.current = null;\s*readyFixRef.current = null;/);
 assert.match(source,/const prepare = \(\) => \{\s*if \(!mountedRef.current \|\| document.hidden \|\|\s*\(phaseRef.current !== 'idle' && phaseRef.current !== 'error'\)\) return;/);
 assert.match(source,/const start = \(\) => \{\s*if \(phaseRef.current !== 'ready' \|\| !watchLifetime.current.isActive\(\) \|\| document.hidden\) return;/);
});
