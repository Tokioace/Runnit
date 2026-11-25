import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAuthSnapshotGuard} from '../src/lib/authSnapshotGuard.ts';

function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}
// Exercise the same ordering checks used by the hook with delayed promises.
function fixture(){
 const guard=createAuthSnapshotGuard(), request=deferred(), captured=guard.capture();
 let state={user:null,loading:true,error:false};
 const done=(async()=>{
  try{
   const user=await request.promise;
   if(guard.isCurrent(captured))state={...state,user,error:false};
  }catch{
   if(guard.isCurrent(captured))state={...state,user:null,error:true};
  }finally{
   if(guard.isCurrent(captured))state={...state,loading:false};
  }
 })();
 return {request,done,guard,event(user){
  if(guard.acceptEvent())state={user,loading:false,error:false};
 },state:()=>state};
}
test('initial snapshot works when no auth notification has superseded it',async()=>{
 const f=fixture();f.request.resolve('A');await f.done;
 assert.deepEqual(f.state(),{user:'A',loading:false,error:false});
 const bad=fixture();bad.request.reject(Error('offline'));await bad.done;
 assert.deepEqual(bad.state(),{user:null,loading:false,error:true});
});
test('late initial login cannot restore an account after logout',async()=>{
 const f=fixture();f.event('A');f.event(null);f.request.resolve('A');await f.done;
 assert.deepEqual(f.state(),{user:null,loading:false,error:false});
});
test('late initial error or empty session cannot replace newer sign-in',async()=>{
 for(const failure of [false,true]){
  const f=fixture();f.event('B');
  if(failure)f.request.reject(Error('offline'));else f.request.resolve(null);
  await f.done;
  assert.deepEqual(f.state(),{user:'B',loading:false,error:false});
 }
});
test('closed subscription ignores both pending result and late notifications',async()=>{
 const f=fixture();f.guard.close();f.event('B');f.request.resolve('A');await f.done;
 assert.deepEqual(f.state(),{user:null,loading:true,error:false});
 const next=fixture();next.event('C');next.request.resolve(null);await next.done;
 assert.equal(next.state().user,'C');
});
test('hook guards all initial result paths and does not restore identities after mutations',()=>{
 const hook=readFileSync(new URL('../src/hooks/useSupabaseUser.ts',import.meta.url),'utf8');
 const init=hook.slice(hook.indexOf('const init = async'),hook.indexOf('void init()'));
 assert.equal((init.match(/if \(!guard\.isCurrent\(initialRevision\)\) return;/g)||[]).length,2);
 assert.match(init,/if \(guard\.isCurrent\(initialRevision\)\) setLoading\(false\)/);
 assert.match(hook,/onAuthStateChange\(\(_event, session\) => \{\s*if \(!guard.acceptEvent\(\)\) return;/);
 assert.match(hook,/guard.close\(\);\s*mutationGuard.current.setAccount\(null\);\s*sub.subscription.unsubscribe\(\)/);
 const mutations=hook.slice(hook.indexOf('const updateDisplayName = useCallback'));
 assert.doesNotMatch(mutations,/setUser\(/);
});
