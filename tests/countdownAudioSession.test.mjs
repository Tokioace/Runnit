import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCountdownAudioSession} from '../src/lib/countdownAudioSession.ts';

function harness(initiallyReady=false) {
 let ready=initiallyReady, attempts=0, schedules=0, stops=0, unlocks=0, resolve;
 const session=createCountdownAudioSession(()=>{
  attempts++;if(!ready)return null;
  schedules++;return()=>{stops++;};
 },()=>{unlocks++;return new Promise(r=>{resolve=r;});});
 return {session, finish(value=true){ready=value;resolve(value);},
  get counts(){return {attempts,schedules,stops,unlocks};}};
}
test('already scheduled tones are not duplicated by manual activation',async()=>{
 const h=harness(true);h.session.start();
 const pending=h.session.activate();h.finish();await pending;
 assert.deepEqual(h.counts,{attempts:1,schedules:1,stops:0,unlocks:1});
 h.session.close();h.session.close();assert.equal(h.counts.stops,1);
});
test('suspended audio schedules only after successful unlock and coalesces repeated taps',async()=>{
 const h=harness();h.session.start();
 const pending=h.session.activate();await h.session.activate();
 assert.equal(h.counts.unlocks,1);assert.equal(h.counts.schedules,0);
 h.finish();await pending;
 assert.equal(h.counts.schedules,1);
 h.session.close();assert.equal(h.counts.stops,1);
});
test('late unlock after abort or unmount cannot schedule tones',async()=>{
 const h=harness();h.session.start();
 const pending=h.session.activate();h.session.close();h.finish();await pending;
 assert.equal(h.counts.schedules,0);
 await h.session.activate();assert.equal(h.counts.unlocks,1);
});
test('failed unlock is retryable without scheduling sound',async()=>{
 const h=harness();h.session.start();
 const first=h.session.activate();h.finish(false);await first;
 assert.equal(h.counts.schedules,0);
 const second=h.session.activate();h.finish();await second;
 assert.equal(h.counts.schedules,1);h.session.close();
});
test('countdown owns manual activation and closes its session on effect cleanup',()=>{
 const source=readFileSync(new URL('../src/components/race/RaceCountdown.tsx',import.meta.url),'utf8');
 assert.match(source,/createCountdownAudioSession\(\(\) => scheduleArcadeStartSfx\(startsAt\), unlockRaceAudio\)/);
 assert.match(source,/void audioSession.current\?\.activate\(\)/);
 assert.match(source,/session.close\(handedOffStart.current === startsAt\)/);
 assert.doesNotMatch(source,/unlockRaceAudio\(\); scheduleArcadeStartSfx/);
});

test('only explicit successful handoff preserves the scheduled GO sound',()=>{
 const stops=[];
 const make=()=>createCountdownAudioSession(()=>preserve=>stops.push(preserve),async()=>true);
 const normal=make();normal.start();normal.close(true);normal.close();
 const abort=make();abort.start();abort.close();
 assert.deepEqual(stops,[true,false]);
});
test('GO handoff is explicitly acknowledged by the matching live duel',()=>{
 const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/race.duelId === matchOverlay.duelId/);
 assert.match(source,/race.startsAt === matchOverlay.startsAt && !endedDuelIdsRef.current.has\(race.duelId\)/);
 assert.match(source,/startedAt: race.startsAt, targetDistanceM: race.targetDistanceM \}\);\s*return true;/);
});

test('Ghost Run acknowledges handoff only after a valid GPS start',()=>{
 const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
 const start=source.indexOf('const beginRun = (): boolean => {');
 assert.ok(start>=0);
 const body=source.slice(start,source.indexOf('\n  };',start));
 const guards=[
  /if \(!lifetime.current.isActive\(\) \|\| phaseRef.current !== 'countdown'\) return false;/,
  /if \(countdownAt === null \|\| countdownAtRef.current !== countdownAt\) return false;/,
  /if \(!canStartGhostCountdown\(countdownAt, startMs, document.visibilityState === 'visible'\)\) \{[^}]*return false;/,
  /if \(!isFreshStartFix\(anchor, startMs\)\) \{[^}]*return false;/,
  /catch \{[^}]*return false;/
 ];
 assert.match(body,/const startMs = Date\.now\(\);/);
 assert.ok(body.indexOf('const startMs = Date.now();')<body.indexOf('isFreshStartFix(anchor, startMs)'));
 const running=body.indexOf("setCurrentPhase('running')");
 assert.ok(running>=0);
 for(const guard of guards) assert.match(body.slice(0,running),guard);
 assert.equal((body.match(/return true;/g)||[]).length,1);
 assert.ok(body.indexOf('return true;')>running);
 assert.match(body,/if \(!isFreshStartFix\(anchor, startMs\)\)/);
 assert.match(body,/setCurrentPhase\('running'\);[\s\S]*return true;/);
 assert.match(source,/onDone=\{beginRun\}/);
});
