import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('map has one authoritative auth source and account-keyed component lifetime',()=>{
 const app=read('src/App.tsx'),map=read('src/screens/MapScreen.tsx');
 assert.match(app, /<Route path="\/map" element=\{<MapScreen key=\{auth.user\?\.id \?\? 'guest'\} auth=\{auth\}/);
 assert.match(map,/MapScreen\(\{ auth \}: \{ auth: UseSupabaseUserReturn \}\)/);
 assert.match(map,/const \{ user: authUser, signIn, signUp, signOut \} = auth;/);
 assert.doesNotMatch(map,/useSupabaseUser\(\)/);
});
test('retired map account is cleared at layout cleanup, not a later network response',()=>{
 const map=read('src/screens/MapScreen.tsx');
 assert.match(map,/React.useLayoutEffect\(\(\) => \{\s*finishAccountRef.current = authUser\?\.id \?\? null;\s*return \(\) => \{ finishAccountRef.current = null; \};/);
 for(const name of ['clearAbortedDuel','showCompletedDuel','closeCompletedDuel','applyMatchedDuel']){
  const start=map.indexOf('const '+name+' = React.useCallback');
  assert.ok(start>=0);
  assert.match(map.slice(start,map.indexOf('}, [authUser?.id]);',start)),/finishAccountRef.current !== authUser.id/);
 }
});
test('late host preflight, join, ready and abort cannot transition an old instance',()=>{
 const map=read('src/screens/MapScreen.tsx');
 assert.match(map,/if \(finishAccountRef.current !== authUser.id\) return;\s*if \(activeCheckError\)/);
 for(const call of ['joinDuel(supabase, run.id)','readyForDuel(supabase, matchedDuel.id)','abortMatchedDuel(supabase, duelId)','cancelHostedOpenDuel(supabase, run.id, authUser.id)']){
  assert.ok(map.includes('await '+call+';\n      if (finishAccountRef.current !== authUser.id) return;')||
    map.includes('await '+call+';\n    if (finishAccountRef.current !== authUser.id) return;'),call);
 }
 assert.match(map,/onFinish=\{\(endedAt, metrics\) => \{\s*if \(finishAccountRef.current !== authUser.id \|\| endedDuelIdsRef.current.has\(race.duelId\)\) return;/);
});
test('retiring the map does not delete saved account-scoped finish or active race keys',()=>{
 const map=read('src/screens/MapScreen.tsx');
 const start=map.indexOf('React.useLayoutEffect(() => {\n    finishAccountRef');
 const end=map.indexOf('}, [authUser?.id]);',start);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(map.slice(start,end),/forgetPendingFinish|forgetActiveDuelId|localStorage/);
});
