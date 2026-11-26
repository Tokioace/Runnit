import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isDuelStartRecoverable} from '../src/lib/duelStartLatch.ts';
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
const start=1700000000000;
test('countdown admission and GO share the existing ten-second late recovery window',()=>{
 assert.equal(isDuelStartRecoverable(start,start-10000),true);
 assert.equal(isDuelStartRecoverable(start,start),true);
 assert.equal(isDuelStartRecoverable(start,start+9999),true);
 assert.equal(isDuelStartRecoverable(start,start+10000),false);
 assert.equal(isDuelStartRecoverable(start,start+60000),false);
 assert.equal(isDuelStartRecoverable(NaN,start),false);
 assert.equal(isDuelStartRecoverable(start,Infinity),false);
});
test('server countdown retains its confirmed lobby for an expired handoff',()=>{
 const a=map.indexOf('const applyMatchedDuel ='),b=map.indexOf('// Display only profile nicknames',a);
 const apply=map.slice(a,b);
 assert.match(apply,/if \(isDuelStartRecoverable\(serverStart, Date.now\(\)\) &&\s*matchStartHandledRef.current !== key\)/);
 assert.match(apply,/matchStartHandledRef.current = key;\s*const startsAt = serverStart;[^\n]*\n\s*setMatchedDuel\(null\);\s*setMatchOverlay\(\{ duelId: row.id, startsAt, targetDistanceM, lobby: \{/);
 assert.match(apply,/id: row.id, hostUserId: row.host_user_id, challengerUserId: row.challenger_user_id,\s*targetDistanceM, hostReady: row.host_ready === true, challengerReady: row.challenger_ready === true, startAt,/);
});
test('expired GO returns to the confirmed lobby without submitting or retiring the duel',()=>{
 const a=map.indexOf('<RaceCountdown'),b=map.indexOf('<RaceOverlay',a);
 assert.ok(a>=0&&b>a);
 const countdown=map.slice(a,b);
 const expired=countdown.slice(countdown.indexOf('if (!isDuelStartRecoverable'),countdown.indexOf('// Use the exact server start timestamp'));
 assert.match(expired,/setRace\(\{ status: 'idle' \}\);/);
 assert.match(expired,/setMatchedDuel\(matchOverlay.lobby \?\? null\);/);
 assert.match(expired,/setDismissedMatchId\(null\);/);
 assert.match(expired,/return false;/);
 assert.doesNotMatch(expired,/activeDuelIdRef.current =|matchStartHandledRef.current =|forgetActiveDuelId\(|submitDuelResult\(|abortMatchedDuel\(/);
 assert.ok(countdown.indexOf('!endedDuelIdsRef.current.has(race.duelId)')<countdown.indexOf('if (!isDuelStartRecoverable'));
 assert.ok(countdown.indexOf('if (!isDuelStartRecoverable')<countdown.indexOf("setRace({ status: 'running'"));
});
