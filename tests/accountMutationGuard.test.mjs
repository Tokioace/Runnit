import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAccountMutationGuard,confirmMutationIdentity} from '../src/lib/accountMutationGuard.ts';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('account mutation guard rejects guest and other identities',()=>{
 const g=createAccountMutationGuard();
 assert.throws(()=>g.begin(null));g.setAccount('A');assert.throws(()=>g.begin('B'));
 const check=g.begin('A');g.setAccount('A');assert.doesNotThrow(check);
 g.setAccount('B');assert.throws(check);
});
test('logout and same-account relogin still invalidate a pending mutation',()=>{
 const g=createAccountMutationGuard();g.setAccount('A');const check=g.begin('A');
 g.setAccount(null);g.setAccount('A');assert.throws(check);assert.doesNotThrow(g.begin('A'));
});
test('identity preflight refuses stale UI before a write can begin',async()=>{
 const g=createAccountMutationGuard();g.setAccount('A');
 const check=g.begin('A');let release;
 const pending=confirmMutationIdentity('A',check,()=>new Promise(r=>{release=r;}));
 g.setAccount('B');release('A');await assert.rejects(pending);
 const b=g.begin('B');await assert.rejects(confirmMutationIdentity('B',b,async()=> 'A'));
 await assert.rejects(confirmMutationIdentity('B',b,async()=>null));
 await confirmMutationIdentity('B',b,async()=> 'B');
});
test('profile account switch remounts draft, history and password form state',()=>{
 const app=read('src/App.tsx'),screen=read('src/screens/ProfileScreen.tsx');
 assert.match(app,/<ProfileScreen key=\{auth\.user\?\.id \?\? 'guest'\} auth=\{auth\}/);
 assert.doesNotMatch(screen,/useSupabaseUser\(\)/);
 assert.match(screen,/const assertCurrent = beginAccountMutation\(\);\s*const \{ data: identity, error: authError \} = await supabase.auth.getUser\(\);\s*assertCurrent\(\)/);
 assert.match(screen,/assertCurrent\(\);\s*if \(saveError \|\| data.user\?\.id !== user.id\)/);
 assert.match(screen,/assertCurrent\(\);\s*if \(updateError \|\| data\?\.leaderboard_opt_in !== next\)/);
});
test('password and name mutations verify identity before write and returned identity afterward',()=>{
 const hook=read('src/hooks/useSupabaseUser.ts');
 for(const [start,end] of [['const changePassword','const updateDisplayName'],['const updateDisplayName','const signOut']]){
  const block=hook.slice(hook.indexOf(start),hook.indexOf(end));
  assert.match(block,/confirmMutationIdentity\(user\?\.id \?\? null, assertCurrent/);
  assert.match(block,/assertCurrent\(\);\s*const \{ data, error \} = await supabase.auth.updateUser/);
  assert.match(block,/assertCurrent\(\);\s*if \(error\) throw error/);
  assert.match(block,/data.user(?:\?|)\.id !== user\?\.id/);
 }
});
