import test from 'node:test';
import assert from 'node:assert/strict';
import {readConfig,runAuthSmoke} from '../scripts/hosted-auth-smoke.mjs';
const idA='00000000-0000-4000-8000-000000000011',idB='00000000-0000-4000-8000-000000000012';
const env={RUNNIT_NATIVE_TEST_REF:'abcdefghijklmnopqrst',RUNNIT_NATIVE_TEST_DATA_CONFIRMED:'synthetic-only',
 RUNNIT_NATIVE_TEST_PUBLISHABLE_KEY:'sb_publishable_fake_test_key_123456',
 RUNNIT_API_TEST_EMAIL_A:'runnit-test-a@example.invalid',RUNNIT_API_TEST_EMAIL_B:'runnit-test-b@example.invalid',
 RUNNIT_API_TEST_PASSWORD_A:'synthetic-password-a',RUNNIT_API_TEST_PASSWORD_B:'synthetic-password-b',
 RUNNIT_API_TEST_ID_A:idA,RUNNIT_API_TEST_ID_B:idB};
test('hosted smoke refuses production and missing explicit synthetic identity',()=>{
 const config=readConfig(env);assert.equal(config.url,'https://abcdefghijklmnopqrst.supabase.co');
 for(const change of [{RUNNIT_NATIVE_TEST_REF:'fcbffqcmvgdojsdfwgyt'},{RUNNIT_NATIVE_TEST_DATA_CONFIRMED:''},{RUNNIT_NATIVE_TEST_PUBLISHABLE_KEY:'sb_secret_never'},{RUNNIT_API_TEST_EMAIL_A:'real@example.invalid'},{RUNNIT_API_TEST_ID_B:idA},{RUNNIT_API_TEST_PASSWORD_A:''}])assert.throws(()=>readConfig({...env,...change}));
});
function fixture({leak=false,stale=false,error=false}={}){
 const sessions=new Map();let sequence=0,logoutCount=0;
 const reply=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
 const request=async(url,opts)=>{
  const u=new URL(url);assert.equal(u.hostname,'abcdefghijklmnopqrst.supabase.co');assert.equal(opts.redirect,'error');assert.ok(opts.signal);
  assert.equal(opts.headers.apikey,env.RUNNIT_NATIVE_TEST_PUBLISHABLE_KEY);
  const token=opts.headers.authorization?.slice(7);
  if(u.pathname==='/auth/v1/token'){
   const body=JSON.parse(opts.body),id=body.email===env.RUNNIT_API_TEST_EMAIL_A?idA:idB;
   const t='fake.token.'+(++sequence);sessions.set(t,{id,revoked:false});
   return reply({access_token:t,user:{id,email:body.email}});
  }
  if(u.pathname==='/auth/v1/logout'){
   assert.equal(u.searchParams.get('scope'),'local');sessions.get(token).revoked=true;logoutCount++;return reply(null,204);
  }
  const session=sessions.get(token),isPrefs=u.pathname.endsWith('runner_stats_preferences');
  const field=isPrefs?'user_id':'id',wanted=u.searchParams.get(field).slice(3);
  if(error&&wanted===idB&&session?.id===idA)return reply(null,500);
  if(!session||session.revoked&&!stale)return reply([]);
  return reply((session.id===wanted||leak)?[{[field]:wanted}]:[]);
 };
 return {request,sessions,get logoutCount(){return logoutCount;}};
}
test('real request contract proves independent sessions and explicit revoked bearer denial',async()=>{
 const f=fixture();const result=await runAuthSmoke(readConfig(env),f.request);
 assert.equal(result.revokedBearerDenied,true);assert.equal(result.independentSessionRetained,true);
 assert.equal(f.logoutCount,3);assert.ok([...f.sessions.values()].every(s=>s.revoked));
});
test('privacy leak, stale bearer access and server error fail and clean up',async()=>{
 for(const options of [{leak:true},{stale:true},{error:true}]){
  const f=fixture(options);await assert.rejects(runAuthSmoke(readConfig(env),f.request));
  assert.ok([...f.sessions.values()].every(s=>s.revoked));
 }
});
