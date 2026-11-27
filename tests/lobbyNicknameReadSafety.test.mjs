import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
const start=source.indexOf('const participantIds = [matchedDuel.hostUserId, matchedDuel.challengerUserId];');
const end=source.indexOf('    return () => { active = false; };',start);
assert.ok(start>=0&&end>start);
const body=source.slice(start,end).replace('void (async () => {','await (async () => {').replace('const resolved: Record<string, string>','const resolved').replace('new Set<string>()','new Set()');
const run=new Function('supabase','matchedDuel','setMatchedNames','active','return (async()=>{'+body+'})();');
const duel={hostUserId:'host',challengerUserId:'rival'};
function setup(response){
 const published=[],queries=[];
 const supabase={from:table=>({select:columns=>({in:async(key,ids)=>{
  queries.push({table,columns,key,ids});
  if(response instanceof Error)throw response;
  return response;
 }})})};
 return {published,queries,read:active=>run(supabase,duel,value=>published.push(value),active)};
}
test('lobby resolves only the requested participants and preserves fallback for missing nicknames',async()=>{
 const h=setup({data:[{id:'host',username:'  Host  '},{id:'rival',username:'x'.repeat(40)}],error:null});
 await h.read(true);
 assert.deepEqual(h.queries,[{table:'users',columns:'id, username',key:'id',ids:['host','rival']}]);
 assert.deepEqual(h.published,[{},{host:'Host',rival:'x'.repeat(36)}]);
 const missing=setup({data:[{id:'host',username:null},{id:'rival',username:' '}],error:null});
 await missing.read(true);
 assert.deepEqual(missing.published,[{},{}]);
});
test('optional lobby nickname errors, malformed rows and retired requests cannot publish names',async()=>{
 for(const response of [new Error('offline'),{data:null,error:null},{data:{},error:null},{data:[null],error:null},{data:[{id:'outside',username:'Other'}],error:null},{data:[{id:'host',username:'A'},{id:'host',username:'B'}],error:null},{data:[{id:'host',username:'A'}],error:{message:'offline'}}]){
  const h=setup(response);await h.read(true);assert.deepEqual(h.published,[{}]);
 }
 const retired=setup({data:[{id:'host',username:'Host'}],error:null});
 await retired.read(false);assert.deepEqual(retired.published,[{}]);
 assert.ok(source.includes('}, [matchedDuel?.id, matchedDuel?.hostUserId, matchedDuel?.challengerUserId, authUser?.id]);'));
 assert.ok(source.includes("matchedNames[matchedDuel.hostUserId] || 'HOST'"));
 assert.ok(source.includes("matchedNames[matchedDuel.challengerUserId] || 'CHALLENGER'"));
});
