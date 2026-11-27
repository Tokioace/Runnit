import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canStartGhostCountdown} from '../src/lib/ghostCountdown.ts';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
test('solo countdown starts only in the bounded visible GO window',()=>{
 const start=1700000000000;
 for(const dt of [0,35,699,700])assert.equal(canStartGhostCountdown(start,start+dt,true),true);
 for(const dt of [-1,701,10000,NaN,Infinity])assert.equal(canStartGhostCountdown(start,start+dt,true),false);
 assert.equal(canStartGhostCountdown(start,start,false),false);
 assert.equal(canStartGhostCountdown(NaN,start,true),false);
});
test('old countdown cannot start a replacement and late GO cannot initialize measurement',()=>{
 const a=source.indexOf('const beginRun ='),b=source.indexOf('useEffect(() =>',a);
 assert.ok(a>=0&&b>a);
 const begin=source.slice(a,b);
 assert.match(begin,/if \(countdownAt === null \|\| countdownAtRef.current !== countdownAt\) return false;/);
 assert.match(begin,/countdownAtRef.current = null;[\s\S]*?if \(!canStartGhostCountdown\(countdownAt, startMs, document.visibilityState === 'visible'\)\) \{[\s\S]*?return false;/);
 assert.ok(begin.indexOf('canStartGhostCountdown(')<begin.indexOf('primeGpsSprint('));
 assert.match(source,/countdownAtRef.current = start;\s*setCountdownAt\(start\);\s*setCurrentPhase\('countdown'\);/);
 assert.match(source,/<RaceCountdown key=\{countdownAt\} startsAt=\{countdownAt\}/);
});
test('background, pagehide and explicit abort retire the countdown synchronously',()=>{
 for(const name of ['hidden','pageHide']){
  const a=source.indexOf('const '+name+' ='),b=source.indexOf('};',a);
  assert.ok(a>=0&&b>a);
  assert.match(source.slice(a,b),/else if \(phaseRef.current === 'countdown'\) \{\s*countdownAtRef.current = null;\s*countdownClockRef.current = null;\s*readyRef.current = null;/);
 }
 assert.match(source,/onAbort=\{async \(\) => \{\s*if \(phaseRef.current !== 'countdown' \|\| countdownAtRef.current !== countdownAt\) return;\s*countdownAtRef.current = null;/);
});

test('failed GO clears invalid GPS readiness and uses the same observed start clock',()=>{
 const begin=source.slice(source.indexOf('const beginRun ='),source.indexOf('useEffect(() =>',source.indexOf('const beginRun =')));
 assert.match(begin,/if \(!canStartGhostCountdown\(countdownAt, startMs, document.visibilityState === 'visible'\)\) \{\s*readyRef.current = null;\s*setFixIssue\('missing'\);\s*setFixTimestampMs\(null\);\s*setAccuracyM\(null\);\s*setNow\(startMs\);/);
 assert.match(begin,/if \(!isFreshStartFix\(anchor, startMs\)\) \{\s*readyRef.current = null;\s*setFixIssue\(inspectGhostGpsFix\(anchor, startMs\).issue\);\s*setNow\(startMs\);\s*setCountdownAt\(null\);\s*setCurrentPhase\('acquiring'\);[\s\S]*?return false;/);
 assert.match(begin,/first = primeGpsSprint\(createGpsSprint\(target, startMs\), anchor\);\s*\} catch \{\s*readyRef.current = null;\s*setFixIssue\('missing'\);\s*setFixTimestampMs\(null\);\s*setAccuracyM\(null\);\s*setNow\(startMs\);/);
 assert.ok(begin.indexOf('if (!isFreshStartFix(anchor, startMs))')<begin.indexOf('activeRef.current = first'));
});


test('Ghost countdown clock is checked before GO and while waiting',()=>{
 const a=source.indexOf('const beginRun ='),b=source.indexOf('useEffect(() =>',a);
 const begin=source.slice(a,b);
 assert.match(source,/countdownClockRef.current = \{wall, mono:performance.now\(\)\};/);
 assert.match(source,/gpsFieldClockChanged\(clock.wall, clock.mono, atMs, performance.now\(\)\)/);
 assert.match(begin,/gpsFieldClockChanged\(clock.wall, clock.mono, startMs, startMono\)/);
 assert.ok(begin.indexOf('gpsFieldClockChanged(')<begin.indexOf('primeGpsSprint('));
});
