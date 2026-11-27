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
function fixture({leak=false,stale=false,error=false,revokedRefresh=false,badRotation=false,badRejection=false,profileLeak=false,emptyProfile=false,badColumnDenial=false,badNickname=false,guestProfileLeak=false,invalidExpiry=false,nearExpiry=false,expireOnLogout=false,invalidateOnRotation=false}={}){
 const sessions=new Map(),tokens=new Map(),refreshes=new Map();let sequence=0,logoutCount=0,refreshCount=0,clock=1000000;
 const reply=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
 const request=async(url,opts)=>{
  const u=new URL(url);assert.equal(u.hostname,'abcdefghijklmnopqrst.supabase.co');assert.equal(opts.redirect,'error');assert.ok(opts.signal);
  assert.equal(opts.headers.apikey,env.RUNNIT_NATIVE_TEST_PUBLISHABLE_KEY);
  const token=opts.headers.authorization?.slice(7);
  function issue(session,previous){
   const t='fake.'+Buffer.from(JSON.stringify({sub:session.id,session_id:session.sid,exp:invalidExpiry?undefined:nearExpiry?1020:4600})).toString('base64url')+'.'+(++sequence);
   const refresh=badRotation&&previous?previous:'refresh-'+sequence;
   tokens.set(t,session);refreshes.set(refresh,session);
   return reply({access_token:t,refresh_token:refresh,user:{id:session.id,email:session.email}});
  }
  if(u.pathname==='/auth/v1/token'){
   const body=JSON.parse(opts.body);
   if(u.searchParams.get('grant_type')==='refresh_token'){
    const session=refreshes.get(body.refresh_token);
    if(!session||session.revoked&&!revokedRefresh)return reply({error_code:badRejection?'unexpected':'refresh_token_not_found'},400);
    refreshCount++;
    if(invalidateOnRotation)for(const [t,s] of tokens)if(s===session)tokens.delete(t);
    if(revokedRefresh&&session.revoked)session.revoked=false;
    return issue(session,body.refresh_token);
   }
   const id=body.email===env.RUNNIT_API_TEST_EMAIL_A?idA:idB;
   const sid='10000000-0000-4000-8000-'+String(sequence+1).padStart(12,'0');
   const session={id,sid,email:body.email,revoked:false};sessions.set(sid,session);
   return issue(session);
  }
  if(u.pathname==='/auth/v1/logout'){
   assert.equal(u.searchParams.get('scope'),'local');tokens.get(token).revoked=true;logoutCount++;if(expireOnLogout)clock=4600000;return reply(null,204);
  }
  const session=tokens.get(token),isPrefs=u.pathname.endsWith('runner_stats_preferences');
  const field=isPrefs?'user_id':'id',wanted=u.searchParams.get(field).slice(3);
  if(error&&wanted===idB&&session?.id===idA)return reply(null,500);
  if(!session||session.revoked&&!stale){
   if(!isPrefs&&!session&&guestProfileLeak)return reply([{id:wanted}]);
   return reply([]);
  }
  if(!isPrefs){
   const select=u.searchParams.get('select');
   if(select==='id,username')return reply([{id:wanted,username:'Synthetic Runner',...(badNickname?{location:'synthetic'}:{})}]);
   if(select!=='id'){
    if(profileLeak)return reply([{[select]:'synthetic'}]);
    if(emptyProfile)return reply([]);
    return reply({code:badColumnDenial?'PGRST204':'42501'},403);
   }
  }
  return reply((session.id===wanted||leak)?[{[field]:wanted}]:[]);
 };
 return {request,sessions,now:()=>clock,get logoutCount(){return logoutCount;},get refreshCount(){return refreshCount;}};
}
test('real request contract proves independent sessions and explicit revoked bearer denial',async()=>{
 const f=fixture();const result=await runAuthSmoke(readConfig(env),f.request,f.now);
 assert.equal(result.revocationBeforeTokenExpiry,true);assert.equal(result.revokedBearerDenied,true);assert.equal(result.independentSessionRetained,true);
 assert.equal(f.logoutCount,3);assert.equal(f.refreshCount,2);assert.ok([...f.sessions.values()].every(s=>s.revoked));
 assert.equal(result.publicNicknameReadable,true);assert.equal(result.privateProfileColumnsDenied,true);assert.equal(result.guestProfileDenied,true);
 assert.equal(result.refreshRotation,true);assert.equal(result.revokedRefreshDenied,true);assert.equal(result.independentRefreshRetained,true);
});
test('privacy leak, stale bearer access and server error fail and clean up',async()=>{
 for(const options of [{leak:true},{stale:true},{error:true}]){
  const f=fixture(options);await assert.rejects(runAuthSmoke(readConfig(env),f.request,f.now));
  assert.ok([...f.sessions.values()].every(s=>s.revoked));
 }
});

test('refresh rotation, revoked refresh acceptance and unrelated API errors cannot pass',async()=>{
 for(const options of [{revokedRefresh:true},{badRotation:true},{badRejection:true}]){
  const f=fixture(options);await assert.rejects(runAuthSmoke(readConfig(env),f.request,f.now));
  assert.ok([...f.sessions.values()].every(s=>s.revoked));
 }
});

test('profile privacy requires explicit column denial and a working public nickname read',async()=>{
 for(const options of [{profileLeak:true},{emptyProfile:true},{badColumnDenial:true},{badNickname:true},{guestProfileLeak:true}]){
  const f=fixture(options);
  await assert.rejects(runAuthSmoke(readConfig(env),f.request,f.now));
  assert.ok([...f.sessions.values()].every(s=>s.revoked));
 }
});

test('logout proof requires unexpired access tokens and positive controls for both generations',async()=>{
 for(const [options,message] of [
  [{invalidExpiry:true},/Missing or invalid access token expiry/],
  [{nearExpiry:true},/expiry too close/],
  [{expireOnLogout:true},/expiry too close/],
  [{invalidateOnRotation:true},/Own fixture row missing/]
 ]){
  const f=fixture(options);
  await assert.rejects(runAuthSmoke(readConfig(env),f.request,f.now),message);
  assert.ok([...f.sessions.values()].every(s=>s.revoked));
 }
});
