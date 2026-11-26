import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isFreshStartFix} from '../src/lib/gpsField.ts';
import {inspectGhostGpsFix} from '../src/lib/ghostGpsReadiness.ts';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');

test('an accurate stationary fix expires without a new browser callback',()=>{
 const fix={latitude:48,longitude:9,accuracyM:4.9,timestampMs:10000};
 assert.equal(isFreshStartFix(fix,13000),true);
 assert.equal(isFreshStartFix(fix,13001),false);
 assert.equal(inspectGhostGpsFix(fix,13001).issue,'stale');
 assert.equal(inspectGhostGpsFix(fix,9999).issue,'future-timestamp');
 assert.equal(isFreshStartFix({...fix,timestampMs:13001},13001),true);
});
test('ready expiry clears the anchor, updates the displayed diagnosis and resumes acquiring',()=>{
 const a=source.indexOf('const expireReadyFix ='),b=source.indexOf('const requestGpsRefresh =',a);
 assert.ok(a>=0&&b>a);
 const block=source.slice(a,b);
 assert.match(block,/if \(phaseRef.current !== 'ready' \|\| !gpsLifetime.current.isActive\(\)\) return false;/);
 assert.match(block,/if \(isFreshStartFix\(anchor, atMs\)\) return false;/);
 assert.match(block,/readyRef.current = null;\s*setFixIssue\(info.issue\);\s*setNow\(atMs\);\s*setCurrentPhase\('acquiring'\);\s*setNotice\(ghostGpsFixNotice\(info\)\);/);
 assert.match(block,/if \(!isGpsLive\(\) \|\| document.visibilityState !== 'visible'/);
 assert.match(block,/if \(!expireReadyFix\(atMs\)\) setNow\(atMs\);/);
 assert.match(block,/window.setInterval\(tick, 250\)/);
 assert.match(source,/if \(phase !== 'acquiring' \|\| !navigator.geolocation\) return;/);
});
test('start action shares expiry guard and preparation callbacks refresh the displayed clock',()=>{
 const a=source.indexOf('const beginCountdown ='),b=source.indexOf('// While stationary iOS',a);
 assert.ok(a>=0&&b>a);
 const start=source.slice(a,b);
 assert.match(start,/if \(expireReadyFix\(Date.now\(\)\)\) return;/);
 assert.ok(start.indexOf('expireReadyFix(')<start.indexOf('countdownAtRef.current = start'));
 assert.match(source,/latestPreparationFixMs.current = order.timestampMs;\s*setNow\(observedNow\);/);
});
