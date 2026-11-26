import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDuelResultRows,determineDuelOutcome} from '../src/lib/duelOutcome.ts';
const host={user_id:'host',time_ms:6000,username:'A'};
const rival={user_id:'rival',time_ms:7000,username:'B'};
const validate=rows=>validateDuelResultRows(rows,'host','rival');

test('valid complete and partial snapshots preserve their actual rows',()=>{
 assert.deepEqual(validate([]),[]);
 assert.deepEqual(validate([host]),[host]);
 assert.deepEqual(validate([rival]),[rival]);
 assert.equal(determineDuelOutcome(validate([rival,host]),'host','completed'),'won');
 assert.equal(determineDuelOutcome(validate([host,rival]),'rival','completed'),'lost');
 assert.equal(determineDuelOutcome(validate([host,{...rival,time_ms:6000}]),'host','completed'),'tie');
 assert.equal(determineDuelOutcome(validate([host]),'host','completed'),'pending');
 assert.equal(determineDuelOutcome(validate([host,rival]),'host','matched'),'pending');
});
test('foreign, duplicate, malformed or extra rows invalidate the whole snapshot',()=>{
 for(const rows of [[host,host],[rival,rival],[host,{...rival,user_id:'foreign'}],
  [host,rival,{user_id:'foreign',time_ms:1}],[host,rival,null],[host,null],
  [host,{...rival,time_ms:0}],[host,{...rival,time_ms:NaN}],[host,{...rival,time_ms:'7000'}],
  [host,{...rival,time_ms:Infinity}],null,{},[undefined]]){
  assert.equal(validate(rows),null);
  assert.equal(determineDuelOutcome(validate(rows)??[],'host','completed'),'pending');
 }
});
test('missing or identical participant identities never authorize result rows',()=>{
 for(const [a,b] of [[null,'rival'],['host',null],['','rival'],['host','host'],['host',' ']]){
  assert.equal(validateDuelResultRows([host,rival],a,b),null);
 }
});
test('finish screen validates the complete snapshot before deriving winner or displayed times',()=>{
 const s=readFileSync(new URL('../src/components/race/DuelFinishScreen.tsx',import.meta.url),'utf8');
 assert.match(s,/const validatedResults = validateDuelResultRows\(rows, hostId, challengerId\);/);
 assert.match(s,/const uniqueResults = validatedResults \?\? \[\];/);
 assert.match(s,/determineDuelOutcome\(uniqueResults, userId, status\)/);
 assert.match(s,/const mine = uniqueResults.find/);
 assert.match(s,/const other = uniqueResults.find/);
 assert.match(s,/fetchError \|\| resultDataError/);
 assert.doesNotMatch(s,/rows.filter\(/);
});
