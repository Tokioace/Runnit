import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMeasurementLifetime,measurementAccountCurrent} from '../src/lib/measurementLifetime.ts';
import {createAccountMutationGuard,confirmMutationIdentity} from '../src/lib/accountMutationGuard.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('delayed calibration permission cannot start sensors after reset or unmount',async()=>{
 for(const reset of [false,true]){
  const lifetime=createMeasurementLifetime();lifetime.open();
  const account=createAccountMutationGuard();account.setAccount('A');
  const isLive=lifetime.capture(),check=account.begin('A');
  let resolve,started=0;
  const pending=(async()=>{await new Promise(r=>{resolve=r});if(measurementAccountCurrent(isLive,check))started++;})();
  lifetime.close();if(reset)lifetime.open();resolve();await pending;
  assert.equal(started,0);
 }
});
test('measurement identity remains tied to the start even after same-account relogin',()=>{
 const life=createMeasurementLifetime();life.open();
 const guard=createAccountMutationGuard();guard.setAccount('A');
 const current=()=>measurementAccountCurrent(life.capture(),guard.begin('A'));
 assert.equal(current(),true);
 const captured=guard.begin('A'),isLive=life.capture();
 guard.setAccount(null);guard.setAccount('A');
 assert.equal(measurementAccountCurrent(isLive,captured),false);
});
test('late server identity cannot authorize saving retired calibration',async()=>{
 const life=createMeasurementLifetime();life.open();
 const guard=createAccountMutationGuard();guard.setAccount('A');
 const live=life.capture(),check=guard.begin('A');
 const current=()=>{if(!measurementAccountCurrent(live,check))throw Error('retired');};
 let resolve;
 const pending=confirmMutationIdentity('A',current,()=>new Promise(r=>{resolve=r;}));
 life.close();resolve('A');await assert.rejects(pending,/retired/);
});
test('screen owns permission, sensor callbacks and cleanup by account and attempt',()=>{
 const s=read('src/screens/StrideCalibrationScreen.tsx');
 assert.doesNotMatch(s,/useSupabaseUser\(\)/);
 assert.match(s,/const \{ user, beginAccountMutation \} = auth/);
 assert.match(s,/const permission = motion.requestPermission \? await motion.requestPermission\(\) : 'granted';\s*if \(!isCurrent\(\)\) return;/);
 assert.match(s,/watchPosition\(position => \{\s*if \(!isCurrent\(\)\) return;/);
 assert.match(s,/if \(!isCurrent\(\) \|\| phaseRef.current !== 'walking'\) return/);
 assert.match(s,/lifetime.current.close\(\);\s*measurementCurrent.current = null;\s*phaseRef.current = 'idle';\s*stopSensors\(\)/);
 assert.match(s,/\['start', 'walking', 'end'\].includes\(phaseRef.current\)/);
 assert.match(s,/window.addEventListener\('pagehide', interrupt\)/);
});
test('save checks original measurement and server identity, reset cannot race a pending write',()=>{
 const s=read('src/screens/StrideCalibrationScreen.tsx');
 const save=s.slice(s.indexOf('const save = async'),s.indexOf('const startReady'));
 assert.match(save,/const isCurrent = measurementCurrent.current/);
 assert.match(save,/confirmMutationIdentity\(user.id, assertCurrent/);
 assert.match(save,/supabase.auth.getUser\(\)/);
 assert.match(save,/assertCurrent\(\);\s*const \{ data, error: saveError \} = await supabase.auth.updateUser/);
 assert.match(save,/assertCurrent\(\);\s*if \(saveError \|\| data.user\?\.id !== user.id\)/);
 assert.match(s,/const reset = \(\) => \{\s*if \(!lifetime.current.isActive\(\) \|\| pendingRef.current\) return/);
});
