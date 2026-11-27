import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createErasureSessionProbe} from '../scripts/account-erasure-session-probe.mjs';
const userId='00000000-0000-4000-8000-000000000011',controlDuelId='00000000-0000-4000-8000-000000000012',other='00000000-0000-4000-8000-000000000013';
const ref='aaaaaaaaaaaaaaaaaaaa',url='https://'+ref+'.supabase.co';
const token=claims=>'e30.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.sig';
const opts={url,ref,userId,controlDuelId,publishableKey:'sb_publishable_test',accessToken:token({sub:userId,role:'authenticated',session_id:other,exp:200})};
function fixture({afterStatus=200,afterRows=[],beforeRows=[{id:controlDuelId}],identity=userId,host=other,afterHost=host,afterControl=true}={}){
 let clock=100000,reads=0,controls=0;
 const admin={from(table){assert.equal(table,'duels');return {select(){return this},eq(){return this},async maybeSingle(){controls++;return {data:controls===1||afterControl?{id:controlDuelId,host_user_id:controls===1?host:afterHost,challenger_user_id:null,status:'open'}:null}}}}};
 const fetcher=async(path,options)=>{assert.equal(options.headers.apikey,opts.publishableKey);assert.equal(options.headers.Authorization,'Bearer '+opts.accessToken);assert.equal(options.redirect,'error');
  if(path===url+'/auth/v1/user')return {status:200,json:async()=>({id:identity})};
  assert.equal(path,url+'/rest/v1/duels?select=id&id=eq.'+controlDuelId);reads++;return {status:reads===1?200:afterStatus,json:async()=>reads===1?beforeRows:afterRows};};
 return {probe:createErasureSessionProbe(admin,opts,fetcher,()=>clock),expire:()=>{clock=190000}};
}
test('valid control survives and revoked token receives no rows or explicit denial',async()=>{for(const afterStatus of [200,401,403]){const {probe}=fixture({afterStatus});await probe.before();await probe.after();}});
test('still-visible control and unrelated HTTP failure cannot pass',async()=>{for(const config of [{afterRows:[{id:controlDuelId}]},{afterStatus:500},{afterStatus:404}]){const {probe}=fixture(config);await probe.before();await assert.rejects(probe.after());}});
test('control must survive independently with same host',async()=>{for(const config of [{afterControl:false},{afterHost:'00000000-0000-4000-8000-000000000014'}]){const {probe}=fixture(config);await probe.before();await assert.rejects(probe.after());}});
test('wrong identity, missing baseline, or target-owned control fails preflight',async()=>{for(const config of [{identity:other},{beforeRows:[]},{host:userId}])await assert.rejects(fixture(config).probe.before());});
test('expired token and missing preflight cannot count as denial',async()=>{const f=fixture();await assert.rejects(f.probe.after());await f.probe.before();f.expire();await assert.rejects(f.probe.after());});
test('secret key, wrong role and invalid target blocked before network',()=>{for(const patch of [{publishableKey:'sb_secret_test'},{accessToken:token({sub:userId,role:'service_role',session_id:other,exp:200})},{url:'https://wrong.invalid'}])assert.throws(()=>createErasureSessionProbe(null,{...opts,...patch}));});


test('a failed positive read never authorizes post-erasure denial evidence',async()=>{
 const {probe}=fixture({beforeRows:[]});
 await assert.rejects(probe.before(),/Control duel must be visible/);
 await assert.rejects(probe.after(),/successful preflight/);
});
test('a failed repeated preflight invalidates the previous baseline',async()=>{
 const {probe,expire}=fixture();
 await probe.before();
 expire();
 await assert.rejects(probe.before(),/expires too soon/);
 await assert.rejects(probe.after(),/successful preflight/);
});
test('post-erasure evidence consumes its baseline even on failure',async()=>{
 for(const config of [{},{afterStatus:500}]){
  const {probe}=fixture(config);
  await probe.before();
  if(config.afterStatus)await assert.rejects(probe.after());
  else await probe.after();
  await assert.rejects(probe.after(),/successful preflight/);
 }
});
test('operator CLI never prints raw exception messages',()=>{
 const cli=readFileSync(new URL('../scripts/account-erasure-test.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(cli,/console\.(?:error|log)\([^\n]*(?:error\.message|error instanceof|\berror\b)/);
 assert.match(cli,/console\.error\('Synthetic erasure verification failed\./);
});
