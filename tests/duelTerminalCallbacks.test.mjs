import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
const countdown=map.slice(map.indexOf('<RaceCountdown'),map.indexOf('<RaceOverlay'));
const finish=map.slice(map.indexOf('onFinish={(endedAt, metrics) => {'),map.indexOf('<DuelFinishScreen'));

test('late GO cannot reopen a completed duel or replace another active duel',()=>{
 assert.match(countdown,/if \(finishAccountRef.current !== authUser.id \|\|\s*completedDuelIdsRef.current.has\(matchOverlay.duelId\) \|\|\s*\(!matchOverlay.duelId.startsWith\('demo-run-'\) && activeDuelIdRef.current !== matchOverlay.duelId\)\) return false;/);
 assert.ok(countdown.indexOf('completedDuelIdsRef.current.has')<countdown.indexOf("setRace({ status: 'running'"));
});
test('GO only clears the matching countdown after its handoff has been accepted',()=>{
 assert.match(countdown,/race.startsAt === matchOverlay.startsAt && !endedDuelIdsRef.current.has\(race.duelId\)\) \{\s*setMatchOverlay\(previous => previous\?\.duelId === matchOverlay.duelId &&\s*previous.startsAt === matchOverlay.startsAt \? null : previous\);/);
});
test('late GPS finish cannot repopulate pending data after completion or change of active duel',()=>{
 assert.match(finish,/if \(completedDuelIdsRef.current.has\(race.duelId\) \|\|\s*\(!race.duelId.startsWith\('demo-run-'\) && activeDuelIdRef.current !== race.duelId\)\) return;/);
 assert.ok(finish.indexOf('completedDuelIdsRef.current.has')<finish.indexOf('setRace('));
 assert.ok(finish.indexOf('completedDuelIdsRef.current.has')<finish.indexOf('rememberPendingFinish(payload)'));
});
