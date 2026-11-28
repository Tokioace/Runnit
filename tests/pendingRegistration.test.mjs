import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationPending, markRegistrationPending, clearRegistrationPending } from '../src/lib/pendingRegistration.ts';
import { readFileSync } from 'node:fs';
function fixture() {
 const data=new Map();
 return {data,storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
}
test('registration marker survives reload without storing identity or credentials',()=>{
 const {data,storage}=fixture(); const now=1700000000000;
 assert.equal(registrationPending(storage,now),false);
 markRegistrationPending(storage,now);
 assert.deepEqual([...data.values()],[String(now)]);
 assert.equal(registrationPending(storage,now+1000),true);
 clearRegistrationPending(storage);
 assert.equal(registrationPending(storage,now+1000),false);
});
test('expired, future and corrupt registration marker is retired',()=>{
 for(const raw of ['bad','Infinity','0','1e12','1700000000001','1699998200000']){
  const {data,storage}=fixture();markRegistrationPending(storage,1700000000000);
  data.set([...data.keys()][0],raw);
  assert.equal(registrationPending(storage,1700000000000),false);
  assert.equal(data.size,0);
 }
});
test('unavailable storage does not block signup or login',()=>{
 const storage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
 assert.equal(registrationPending(storage),false);
 assert.doesNotThrow(()=>markRegistrationPending(storage));
 assert.doesNotThrow(()=>clearRegistrationPending(storage));
});
test('web signup explicitly requests the app callback while native avoids web redirect',()=>{
 const src=readFileSync(new URL('../src/hooks/useSupabaseUser.ts',import.meta.url),'utf8');
 const signup=src.slice(src.indexOf('const signUp ='),src.indexOf('const signInWithProvider ='));
 assert.match(signup,/emailRedirectTo: authCallbackUrl\(window\.location\.origin\)/);
 assert.match(signup,/!isNativeAuthRuntime\(\) \? \{ emailRedirectTo:/);
 assert.match(signup,/display_name: nickname/);
});
test('pending web registration restores only the register screen and can be explicitly left',()=>{
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../src/components/profile/AccountAuthPanel.tsx',import.meta.url),'utf8');
 const welcome=readFileSync(new URL('../src/components/auth/WelcomeAuthScreen.tsx',import.meta.url),'utf8');
 assert.match(app,/!auth\.user && location\.pathname === '\/' && !isNativeAuthRuntime\(\) && hasPendingWebRegistration\(\)/);
 assert.match(app,/if \(auth\.user\) forgetWebRegistration\(\)/);
 assert.match(panel,/hideModeSwitch && initialMode === 'signup' && !isNativeAuthRuntime\(\) && hasPendingWebRegistration\(\)/);
 assert.match(welcome,/onClick=\{forgetWebRegistration\}/);
 assert.match(welcome,/initialMode === 'signup' \? forgetWebRegistration : undefined/);
});
