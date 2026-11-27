import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLatestRead} from '../src/lib/latestRead.ts';
import {createMeasurementLifetime} from '../src/lib/measurementLifetime.ts';

function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}
test('a late initial history read cannot overwrite a newer post-save snapshot',async()=>{
 const reader=createLatestRead();
 const old=deferred(),fresh=deferred();
 let rows=['previous'];
 const apply=x=>{rows=x;};
 const a=reader.run(()=>true,()=>old.promise,apply);
 const b=reader.run(()=>true,()=>fresh.promise,apply);
 fresh.resolve(['new run']);await b;
 old.resolve(['old run']);await a;
 assert.deepEqual(rows,['new run']);
});
test('rejected or unsuccessful reads keep the last good snapshot; successful empty rows clear it',async()=>{
 const reader=createLatestRead();
 let rows=['existing'];
 const apply=x=>{rows=x;};
 const old=deferred();
 const a=reader.run(()=>true,()=>old.promise,apply);
 await reader.run(()=>true,async()=>{throw Error('offline');},apply);
 old.resolve(['stale']);await a;
 assert.deepEqual(rows,['existing']);
 await reader.run(()=>true,async()=>null,apply);
 assert.deepEqual(rows,['existing']);
 await reader.run(()=>true,async()=>[],apply);
 assert.deepEqual(rows,[]);
});
test('a retired account lifetime cannot apply rows even if reopened',async()=>{
 const reader=createLatestRead(),life=createMeasurementLifetime(),old=deferred();
 life.open();let applied=0;
 const a=reader.run(life.capture(),()=>old.promise,()=>applied++);
 life.close();life.open();old.resolve(['old account']);await a;
 assert.equal(applied,0);
 await reader.run(life.capture(),async()=>['current account'],()=>applied++);
 assert.equal(applied,1);
});
test('Ghost Run history uses scoped reads, rejects database errors and keeps both refresh paths',()=>{
 const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
 const read=source.slice(source.indexOf('const refreshSaved ='),source.indexOf('const saveSummary ='));
 assert.match(read,/const isScreenLive = lifetime.current.capture\(\);[\s\S]*?const isLive = \(\) => measurementAccountCurrent\(isScreenLive, assertAccount\);/);
 assert.match(read,/savedRunsRead.current.run\(isLive, async \(\) =>/);
 assert.match(read,/\.eq\('user_id', user.id\)/);
 assert.match(read,/if \(error \|\| !Array.isArray\(data\)\) return null;/);
 assert.match(read,/\}, setSavedRuns\);/);
 assert.match(read,/void request.refresh\(\)/);
 assert.match(source,/void refreshSaved\(\).catch/);
});

test('visible reconnect and foreground refresh the private history without permanent polling',()=>{
 const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
 const read=source.slice(source.indexOf('const refreshSaved ='),source.indexOf('const saveSummary ='));
 assert.match(read,/try \{ assertAccount = beginAccountMutation\(\); \} catch \{ return; \}/);
 assert.match(read,/const request = createFinishRefresh\(refreshSaved, \(\) => \{\}\);/);
 assert.match(read,/if \(document.visibilityState === 'visible'\) void request.refresh\(true\);/);
 for(const event of ['online','visibilitychange']){
  assert.ok(read.includes("addEventListener('"+event+"', whenHistoryVisible)"));
  assert.ok(read.includes("removeEventListener('"+event+"', whenHistoryVisible)"));
 }
 assert.match(read,/return \(\) => \{\s*request.close\(\);/);
 assert.doesNotMatch(read,/setInterval|\.insert\(/);
});
