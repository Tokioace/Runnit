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
 assert.match(source,/session.close\(\)/);
 assert.doesNotMatch(source,/unlockRaceAudio\(\); scheduleArcadeStartSfx/);
});
