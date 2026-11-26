import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMeasurementLifetime} from '../src/lib/measurementLifetime.ts';
const source=readFileSync(new URL('../src/components/race/RaceCountdown.tsx',import.meta.url),'utf8');

test('a retired countdown cannot release a replacement countdown abort or show its error',async()=>{
 const life=createMeasurementLifetime();
 life.open();const live=life.capture();
 let resolve,failed=0,pending=true;
 const operation=(async()=>{await new Promise(r=>{resolve=r;});if(live()){pending=false;failed++;}})();
 life.close();life.open();resolve();await operation;
 assert.equal(pending,true);assert.equal(failed,0);
 assert.equal(live(),false);
});
test('abort locks synchronously and a retired countdown cannot run queued ticks',()=>{
 const a=source.indexOf('const confirmExit ='),b=source.indexOf('const doneRef =',a);
 assert.ok(a>=0&&b>a);
 const abort=source.slice(a,b);
 assert.match(abort,/if \(!lifetime.current.isActive\(\) \|\| abortPendingRef.current \|\| finishedRef.current\) return;/);
 assert.match(abort,/abortPendingRef.current = true;\s*setAborting\(true\);/);
 assert.match(abort,/catch \{\s*if \(!isLive\(\) \|\| finishedRef.current\) return;\s*abortPendingRef.current = false;/);
 assert.match(source,/return \(\) => lifetime.current.close\(\);\s*\}, \[startsAt\]\);/);
 assert.match(source,/const tick = \(\) => \{\s*if \(!isLive\(\)\) return;/);
 // A pending abort does not prevent a server-authorized GO.
 const tick=source.slice(source.indexOf('const tick ='),source.indexOf('const audioSession ='));
 assert.doesNotMatch(tick,/abortPendingRef/);
});
test('solo countdown wording is correct without altering duel defaults or countdown CSS',()=>{
 assert.match(source,/mode = 'duel'/);
 assert.match(source,/mode === 'ghost' \? 'SOLO LIVE' : '1V1 LIVE'/);
 assert.match(source,/mode === 'ghost' \? 'GHOST RUN' : '1V1 DUELL'/);
 assert.match(source,/mode === 'ghost' \? 'GHOST RUN ABBRECHEN\?' : 'RENNEN FÜR BEIDE SPIELER ABBRECHEN\?'/);
 const ghost=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
 assert.match(ghost,/<RaceCountdown key=\{countdownAt\} startsAt=\{countdownAt\}[^>]*mode="ghost"/);
});
