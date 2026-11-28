import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStatsGoalRequests} from '../src/lib/statsGoalRequests.ts';
test('read generations supersede old responses without releasing the new read',()=>{
 const gate=createStatsGoalRequests();gate.open();
 const first=gate.beginRead(),second=gate.beginRead();
 assert.equal(first.current(),false);first.finish();
 assert.equal(second.current(),true);assert.equal(gate.beginSave(),null);
 second.finish();assert.ok(gate.beginSave());
});
test('save excludes duplicate saves, reads and refresh until completion',()=>{
 const gate=createStatsGoalRequests();gate.open();
 const write=gate.beginSave();assert.ok(write.current());
 assert.equal(gate.beginSave(),null);assert.equal(gate.beginRead(),null);
 assert.equal(gate.canRefresh(),false);
 write.finish();assert.equal(gate.canRefresh(),true);
 assert.ok(gate.beginRead());
});
test('retired write cannot release a new account operation',()=>{
 const gate=createStatsGoalRequests();gate.open();
 const old=gate.beginSave();gate.close();gate.open();
 const fresh=gate.beginSave();assert.equal(old.current(),false);
 old.finish();assert.equal(fresh.current(),true);fresh.finish();
 assert.equal(gate.canRefresh(),true);
});
test('closed screen cannot issue any new read or write',()=>{
 const gate=createStatsGoalRequests();gate.open();const read=gate.beginRead();
 gate.close();assert.equal(read.current(),false);
 assert.equal(gate.beginRead(),null);assert.equal(gate.beginSave(),null);
 assert.equal(gate.canRefresh(),false);
});
test('stats hook guards async completions and retires requests at layout cleanup',()=>{
 const s=readFileSync(new URL('../src/hooks/useStatsGoal.ts',import.meta.url),'utf8');
 assert.ok(s.includes('useLayoutEffect(()=>'));
 assert.ok(s.includes('return()=>gate.close()'));
 assert.ok(s.includes('if(!write.current())return false'));
 assert.ok(s.includes('if(!current())return'));
 assert.ok(s.includes('if(write.current()){write.finish();setSaving(false);}'));
 assert.ok(s.includes('if(requests.current.canRefresh())setRevision'));
});
