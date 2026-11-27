import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapWithConcurrency} from '../src/lib/mapWithConcurrency.ts';

test('a rejected worker prevents other in-flight workers from launching more queued reads',async()=>{
 const started=[];let release,rejectFirst;
 const result=mapWithConcurrency([0,1,2,3,4],2,async item=>{
  started.push(item);
  if(item===0)await new Promise((_,reject)=>{rejectFirst=reject;});
  if(item===1)await new Promise(resolve=>{release=resolve;});
  return item;
 });
 assert.deepEqual(started,[0,1]);
 rejectFirst(new Error('failed'));
 await assert.rejects(result,/failed/);
 release();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(started,[0,1]);
});
test('successful bounded workers preserve order',async()=>{
 assert.deepEqual(await mapWithConcurrency([4,2,1],2,async n=>n*2),[8,4,2]);
});
test('retired history workers cannot start new reads',async()=>{
 let active=true,release;
 const started=[];
 const result=mapWithConcurrency([0,1,2,3],1,async item=>{
  if(!active)throw Error('retired');
  started.push(item);
  await new Promise(resolve=>{release=resolve;});
  return item;
 });
 active=false;release();
 await assert.rejects(result,/retired/);
 assert.deepEqual(started,[0]);
});
test('history initializes signed-in accounts as loading and guards staged reads',()=>{
 const s=readFileSync(new URL('../src/hooks/useRunnerHistory.ts',import.meta.url),'utf8');
 assert.ok(s.includes('useState<HistoryState>(() => userId ? { ...EMPTY, loading: true } : EMPTY)'));
 assert.ok(s.includes("if (!active) throw new Error('Retired history request')"));
 assert.ok(s.includes("if (response.error) throw response.error;"));
 assert.ok(s.includes('if (!active) return;\n        if (ownResultResponse.error)'));
 assert.ok(s.includes('if (!active) return;\n        for (let i'));
 assert.ok(s.includes('active = false;'));
});

test('history distinguishes valid empty server lists from absent or malformed responses',()=>{
 const s=readFileSync(new URL('../src/hooks/useRunnerHistory.ts',import.meta.url),'utf8');
 const first=s.match(/if \(!Array.isArray\(ownResultResponse.data\) \|\| !Array.isArray\(ghostResponse.data\)\) \{\s*throw new Error\('Invalid history response'\);\s*\}/);
 assert.ok(first);
 const initial=new Function('ownResultResponse','ghostResponse',first[0]+'return true;');
 assert.equal(initial({data:[]},{data:[]}),true);
 for(const invalid of [null,undefined,{},'bad',42]){
  assert.throws(()=>initial({data:invalid},{data:[]}),/Invalid history response/);
  assert.throws(()=>initial({data:[]},{data:invalid}),/Invalid history response/);
 }
 for(const stage of ['duel','paired','archived']){
  const guard=s.match(new RegExp("if \\(!Array\\.isArray\\(response\\.data\\)\\) throw new Error\\('Invalid "+stage+" history response'\\);"));
  assert.ok(guard,stage);
  const check=new Function('response',guard[0]+'return true;');
  assert.equal(check({data:[]}),true);
  for(const invalid of [null,undefined,{},'bad',42]) assert.throws(()=>check({data:invalid}),/Invalid .* history response/);
 }
 assert.doesNotMatch(s,/Response\.data \?\? \[\]|response\.data \?\? \[\]/);
 assert.match(s,/catch \{\s*if \(active\) setState\(\{[\s\S]*?error: 'Deine gespeicherten Ergebnisse konnten nicht geladen werden/);
});
