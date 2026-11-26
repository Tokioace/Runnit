import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clearReadyRequest,readyRequestView} from '../src/lib/duelReadiness.ts';
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
test('a pending Ready request and error belong only to their duel',()=>{
 const error={duelId:'a',message:'offline'};
 assert.deepEqual(readyRequestView('a',false,'a',error),{busy:true,error:'offline'});
 assert.deepEqual(readyRequestView('b',false,'a',error),{busy:false,error:null});
 assert.deepEqual(readyRequestView(null,false,'a',error),{busy:false,error:null});
 assert.deepEqual(readyRequestView('a',true,'a',error),{busy:false,error:null});
});
test('a retired Ready request cannot clear the busy indicator of a replacement duel',()=>{
 let pending='a';
 assert.equal(clearReadyRequest(pending,'b'),'a');
 pending='b';
 assert.equal(clearReadyRequest(pending,'a'),'b');
 assert.equal(clearReadyRequest(pending,'b'),null);
 assert.equal(clearReadyRequest(null,'a'),null);
});
test('MapScreen scopes Ready UI updates and keeps the server write gate',()=>{
 const a=map.indexOf('const confirmMatchReady ='),b=map.indexOf('// Joining and starting races',a);
 assert.ok(a>=0&&b>a);
 const ready=map.slice(a,b);
 assert.match(map,/readyRequestView\(\s*matchedDuel\?\.id \?\? null, ownReady, readyBusyDuelId, readyErrorForDuel\)/);
 assert.match(ready,/setReadyBusy\(matchedDuel.id\);/);
 assert.match(ready,/if \(stillCurrent\(\)\) setReadyError\(\{ duelId: matchedDuel.id,/);
 assert.match(ready,/finally \{\s*releaseWrite\(\);\s*if \(finishAccountRef.current === authUser.id\) \{\s*setReadyBusy\(previous => clearReadyRequest\(previous, matchedDuel.id\)\);/);
 assert.ok(ready.indexOf('tryAcquire(matchedDuel.id)')<ready.indexOf('setReadyBusy(matchedDuel.id)'));
 assert.match(map,/readyBusy=\{readyBusy\}\s*readyError=\{readyError\}/);
});
