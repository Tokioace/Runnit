import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapWithConcurrency} from '../src/lib/mapWithConcurrency.ts';
import {createFinishRefresh} from '../src/lib/finishRefresh.ts';
import {hasUniqueOwnedHistoryRows,hasRequestedDuelMetadata} from '../src/lib/runnerHistory.ts';

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

test('personal history rejects duplicate, foreign and invalid row identities',()=>{
 for(const key of ['id','duel_id']){
  const a={[key]:'a',user_id:'owner'},b={[key]:'b',user_id:'owner'};
  assert.equal(hasUniqueOwnedHistoryRows([],key,'owner'),true);
  assert.equal(hasUniqueOwnedHistoryRows([a,b],key,'owner'),true);
  for(const rows of [[a,a],[a,{...a,time_ms:9000}],[{...a,user_id:'other'}],[{...a,user_id:undefined}],[{...a,[key]:''}],[{...a,[key]:42}],[null],[[]]]){
   assert.equal(hasUniqueOwnedHistoryRows(rows,key,'owner'),false);
  }
 }
 const s=readFileSync(new URL('../src/hooks/useRunnerHistory.ts',import.meta.url),'utf8');
 assert.match(s,/\.select\('id,user_id,created_at,target_distance_m,run_state,elapsed_ms,observed_distance_m,steps_count,motion_permission'\)/);
 assert.match(s,/if \(!hasUniqueOwnedHistoryRows\(ownResultResponse.data, 'duel_id', userId!\) \|\|\s*!hasUniqueOwnedHistoryRows\(ghostResponse.data, 'id', userId!\)\) \{\s*throw new Error\('Contradictory personal history response'\);/);
 assert.ok(s.indexOf('if (!hasUniqueOwnedHistoryRows')<s.indexOf('const ids ='));
});

test('visible online recovery refreshes history and removes its listener on retirement',()=>{
 const s=readFileSync(new URL('../src/hooks/useRunnerHistory.ts',import.meta.url),'utf8');
 const block=s.slice(s.indexOf('const onFocus ='),s.indexOf('// Calendar boundaries'));
 assert.match(block,/window.addEventListener\('online', onFocus\)/);
 assert.match(block,/active = false;[\s\S]*?window.removeEventListener\('online', onFocus\)/);
 const handler=block.match(/const onFocus = (\(\) => \{[^\n]+\});/);
 assert.ok(handler);
 let refreshes=0;
 const doc={visibilityState:'visible'};
 const onFocus=new Function('document','refresh','return '+handler[1])(doc,()=>refreshes++);
 onFocus();
 assert.equal(refreshes,1);
 doc.visibilityState='hidden';
 onFocus();
 assert.equal(refreshes,1);
 doc.visibilityState='visible';
 onFocus();
 assert.equal(refreshes,2);
 assert.doesNotMatch(block,/setInterval/);
});

test('overlapping history refreshes coalesce into a single follow-up',async()=>{
 let reads=0,inFlight=0,peak=0;
 const pending=[];
 const queue=createFinishRefresh(async()=>{
  reads++;inFlight++;peak=Math.max(peak,inFlight);
  await new Promise(resolve=>pending.push(resolve));
  inFlight--;
 },()=>assert.fail('unexpected read failure'));
 const first=queue.refresh();
 await Promise.all([queue.refresh(true),queue.refresh(true),queue.refresh(true)]);
 assert.equal(reads,1);
 pending.shift()();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(reads,2);
 assert.equal(peak,1);
 pending.shift()();
 await first;
 assert.equal(reads,2);
});
test('retired history queue drops pending follow-up and further requests',async()=>{
 let reads=0,release;
 const queue=createFinishRefresh(async()=>{
  reads++;
  await new Promise(resolve=>{release=resolve;});
 },()=>assert.fail('unexpected read failure'));
 const first=queue.refresh();
 await queue.refresh(true);
 queue.close();
 release();await first;
 await queue.refresh(true);
 assert.equal(reads,1);
});
test('history uses one queue per account and retires its public refresh callback',()=>{
 const s=readFileSync(new URL('../src/hooks/useRunnerHistory.ts',import.meta.url),'utf8');
 assert.match(s,/const requestRefresh = useRef<\(\(\) => void\) \| null>\(null\);/);
 assert.match(s,/const refresh = useCallback\(\(\) => requestRefresh.current\?\.\(\), \[\]\);/);
 assert.match(s,/async function read\(\) \{\s*if \(!active\) return;\s*setState\(prev => \(\{ \.\.\.prev, loading: true, error: null \}\)\);/);
 assert.match(s,/const queue = createFinishRefresh\(read, \(\) => \{\}\);\s*const request = \(\) => \{ void queue.refresh\(true\); \};\s*requestRefresh.current = request;\s*void queue.refresh\(\);/);
 assert.match(s,/active = false;\s*queue.close\(\);\s*if \(requestRefresh.current === request\) requestRefresh.current = null;/);
 assert.match(s,/\}, \[userId, refresh\]\);/);
 assert.doesNotMatch(s,/reload\(n => n \+ 1\)/);
});

test('duel metadata must match requested IDs and the current participant before paired RPCs',()=>{
 const a={id:'a',host_user_id:'owner',challenger_user_id:'rival'};
 const b={id:'b',host_user_id:'rival',challenger_user_id:'owner'};
 for(const rows of [[],[a],[b],[a,b]]) assert.equal(hasRequestedDuelMetadata(rows,['a','b'],'owner'),true);
 for(const rows of [[a,a],[a,{...a,status:'completed'}],[{...a,id:'c'}],[{...a,host_user_id:'other'}],[null],[[]],[{}],[{...a,id:42}]])
  assert.equal(hasRequestedDuelMetadata(rows,['a','b'],'owner'),false);
 const s=readFileSync(new URL('../src/hooks/useRunnerHistory.ts',import.meta.url),'utf8');
 assert.match(s,/if \(!hasRequestedDuelMetadata\(response.data, ids, userId!\)\) throw new Error\('Contradictory duel history response'\);/);
 assert.ok(s.indexOf('if (!hasRequestedDuelMetadata')<s.indexOf('const pairResponses ='));
});
