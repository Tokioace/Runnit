import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
test('manual refresh has one owner and late errors cannot override a ready fix',()=>{
 const a=source.indexOf('const requestGpsRefresh ='),b=source.indexOf('const beginCountdown =',a);
 assert.ok(a>=0&&b>a);
 const block=source.slice(a,b);
 assert.match(block,/manualGpsRequestRef.current !== null\) return;/);
 assert.match(block,/const token = Symbol\('manual GPS refresh'\);\s*manualGpsRequestRef.current = token;/);
 assert.match(block,/manualGpsRequestRef.current === token && document.visibilityState === 'visible'/);
 assert.match(block,/if \(manualGpsRequestRef.current === token\) manualGpsRequestRef.current = null;/);
 assert.match(block,/if \(stillPreparing\(\) && phaseRef.current === 'acquiring'\)/);
 assert.match(block,/const current = stillPreparing\(\);\s*release\(\);\s*if \(current\) onGps\(pos\);/);
});
test('watch retirement and starting the countdown retire manual GPS ownership',()=>{
 const a=source.indexOf('const stopGps ='),b=source.indexOf('const refreshSaved =',a);
 assert.ok(a>=0&&b>a);
 assert.match(source.slice(a,b),/watchRef.current = null;\s*manualGpsRequestRef.current = null;/);
 assert.match(source,/manualGpsRequestRef.current = null;\s*countdownAtRef.current = start;/);
});
test('countdown GPS callback requires exact active countdown and abort restores only fresh readiness',()=>{
 assert.match(source,/const stillCounting = \(\) => !cancelled && isGpsLive\(\) && phaseRef.current === 'countdown' &&\s*countdownAtRef.current === countdownAt && document.visibilityState === 'visible';/);
 assert.match(source,/if \(!stillCounting\(\)\) return;/);
 assert.match(source,/pos => \{ if \(stillCounting\(\)\) onGps\(pos\); \}/);
 const a=source.indexOf('onAbort={async () => {',source.indexOf('<RaceCountdown')),b=source.indexOf('}} />',a);
 assert.ok(a>=0&&b>a);
 const abort=source.slice(a,b);
 assert.match(abort,/const atMs = Date.now\(\);\s*const anchor = readyRef.current;\s*const fresh = isFreshStartFix\(anchor, atMs\);\s*setNow\(atMs\);/);
 assert.match(abort,/if \(!fresh\) \{[\s\S]*?if \(anchor !== null\) setFixIssue\(inspectGhostGpsFix\(anchor, atMs\).issue\);\s*readyRef.current = null;\s*\}\s*setCurrentPhase\(fresh \? 'ready' : 'acquiring'\);/);
 assert.doesNotMatch(abort,/setFixIssue\('missing'\)/);
});
