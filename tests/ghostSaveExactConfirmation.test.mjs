import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isGhostSaveConflict,matchesGhostSave} from '../src/lib/ghostSaveResponse.ts';

test('a primary key conflict requires verification, ordinary failures do not',()=>{
 assert.equal(isGhostSaveConflict({code:'23505'}),true);
 for(const error of [null,{},'23505',{code:'42501'},{code:'23514'}])assert.equal(isGhostSaveConflict(error),false);
});
test('only an exact owner and complete matching measurement can confirm the save',()=>{
 const payload={id:'run',user_id:'owner',elapsed_ms:null,steps_count:12,source:'ios-web-beta'};
 assert.equal(matchesGhostSave(payload,{...payload,created_at:'server'}),true);
 for(const row of [null,[],{id:'run',user_id:'owner'},{...payload,user_id:'other'},{...payload,id:'other'},{...payload,elapsed_ms:0},{...payload,steps_count:13}])
  assert.equal(matchesGhostSave(payload,row),false);
});
test('one secure ID is reused for the same run and readback remains account scoped',()=>{
 const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
 const a=source.indexOf('const saveSummary ='),b=source.indexOf('const stopRun =',a);
 assert.ok(a>=0&&b>a);
 const save=source.slice(a,b);
 assert.match(save,/saveIdRef.current \?\?= crypto.randomUUID\(\);/);
 assert.match(save,/const payload = \{ id: saveIdRef.current, user_id: user.id, \.\.\.item, source: 'ios-web-beta' \};/);
 assert.match(save,/\.from\('ghost_run_sessions'\)\.insert\(payload\)/);
 assert.match(save,/if \(uncertain && measurementAccountCurrent\(isLive, assertAccount\)\)/);
 assert.match(save,/\.eq\('user_id', user.id\)\.eq\('id', payload.id\)\.abortSignal\(signal\)\.maybeSingle\(\)\);/);
 assert.match(save,/if \(!readError && matchesGhostSave\(payload, data\)\) \{\s*uncertain = false;\s*error = null;/);
 assert.match(save,/if \(!measurementAccountCurrent\(isLive, assertAccount\)\) return;\s*savePendingRef.current = false;/);
 assert.match(source,/stepRef.current.reset\(\);\s*savedRef.current = false;\s*saveIdRef.current = null;/);
 assert.doesNotMatch(save,/\.upsert\(|\.update\(|localStorage/);
});
