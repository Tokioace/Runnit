import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const lobby=readFileSync(new URL('../src/components/race/ReadyLobby.tsx',import.meta.url),'utf8');
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
test('missed start is shown in the existing lobby status and disables readiness regardless of previous flags',()=>{
 assert.match(lobby,/startMissed = false/);
 assert.match(lobby,/startMissed\s*\? 'RENNSTART VERPASST\. DUELL ABBRECHEN UND EIN NEUES RENNEN STARTEN\.'/);
 assert.match(lobby,/disabled=\{startMissed \|\| mineReady \|\| readyBusy\}/);
 assert.match(lobby,/startMissed \? 'START VERPASST' : readyBusy \?/);
 assert.match(lobby,/readyError && !startMissed &&/);
});
test('a missed server start does not trigger new sensor permission, audio or Ready requests',()=>{
 const a=map.indexOf('<ReadyLobby'),b=map.indexOf('<RaceCountdown',a);
 assert.ok(a>=0&&b>a);
 const block=map.slice(a,b);
 assert.match(block,/startMissed=\{matchedDuel.startAt !== null\}/);
 const handler=block.slice(block.indexOf('onReady={() => {'),block.indexOf('onSoundToggle='));
 const guard=handler.indexOf('if (matchedDuel.startAt !== null) return;');
 assert.ok(guard>=0);
 for(const marker of ['unlockRaceAudio()','requestDuelMotionPermission()','confirmMatchReady()'])
  assert.ok(handler.indexOf(marker)>guard,marker);
});
test('missed-start lobby retains the explicit server-confirmed abort and return-to-map actions',()=>{
 assert.match(lobby,/DUELL FÜR BEIDE ABBRECHEN/);
 assert.match(lobby,/onClick=\{\(\) => \{ void confirmExit\(\); \}\}/);
 assert.match(lobby,/await onAbort\(\);/);
 assert.match(lobby,/onClick=\{onBack\}/);
 assert.match(map,/onAbort=\{\(\) => confirmAbortMatchedDuel\(matchedDuel.id\)\}/);
 assert.match(map,/setMatchedDuel\(matchOverlay.lobby \?\? null\);/);
});
