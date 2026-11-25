// Operator-only test. No admin credential, sign-up or application data mutation.
import {pathToFileURL} from 'node:url';
const PROD='fcbffqcmvgdojsdfwgyt';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireThat(condition,message){if(!condition)throw Error(message);}
export function readConfig(env){
 const ref=env.RUNNIT_NATIVE_TEST_REF,key=env.RUNNIT_NATIVE_TEST_PUBLISHABLE_KEY;
 requireThat(env.RUNNIT_NATIVE_TEST_DATA_CONFIRMED==='synthetic-only','Synthetic test project confirmation required');
 requireThat(typeof ref==='string'&&/^[a-z]{20}$/.test(ref)&&ref!==PROD,'Distinct test project required');
 requireThat(typeof key==='string'&&/^sb_publishable_[A-Za-z0-9_-]{16,128}$/.test(key),'Publishable key required');
 const accounts=['A','B'].map(label=>{
  const email=env['RUNNIT_API_TEST_EMAIL_'+label],password=env['RUNNIT_API_TEST_PASSWORD_'+label];
  const id=env['RUNNIT_API_TEST_ID_'+label];
  requireThat(typeof email==='string'&&/^runnit-test-[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email),'Explicit synthetic test email required');
  requireThat(typeof password==='string'&&password.length>=12&&UUID.test(id||''),'Explicit test identity and password required');
  return {email,password,id};
 });
 requireThat(accounts[0].id!==accounts[1].id&&accounts[0].email.toLowerCase()!==accounts[1].email.toLowerCase(),'Distinct accounts required');
 return {url:'https://'+ref+'.supabase.co',key,accounts};
}
export async function runAuthSmoke(config,request=fetch){
 const {url,key,accounts}=config;
 requireThat(/^https:\/\/[a-z]{20}\.supabase\.co$/.test(url)&&!url.includes(PROD),'Non-production URL required');
 requireThat(/^sb_publishable_[A-Za-z0-9_-]{16,128}$/.test(key),'Publishable key required');
 const live=new Set();
 async function call(path,{token,method='GET',body}={}){
  const headers={apikey:key,accept:'application/json'};
  if(token)headers.authorization='Bearer '+token;
  if(body!==undefined)headers['content-type']='application/json';
  try{return await request(url+path,{method,headers,redirect:'error',signal:AbortSignal.timeout(10000),...(body===undefined?{}:{body:JSON.stringify(body)})});}
  catch{throw Error('Test API request failed');}
 }
 async function json(response,label){
  requireThat(response.ok,label+' rejected');
  try{return await response.json();}catch{throw Error(label+' invalid response');}
 }
 async function login(account){
  const data=await json(await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email:account.email,password:account.password}}),'Password sign-in');
  const token=data?.access_token;
  requireThat(typeof token==='string'&&token.split('.').length===3,'Missing access token');
  live.add(token);
  requireThat(data.user?.id===account.id&&data.user?.email?.toLowerCase()===account.email.toLowerCase()&&data.user?.is_anonymous!==true,'Unexpected test identity');
  return token;
 }
 async function logout(token){
  const response=await call('/auth/v1/logout?scope=local',{method:'POST',token});
  requireThat(response.ok,'Local logout not confirmed');live.delete(token);
 }
 async function rows(table,token,filter){
  const response=await call('/rest/v1/'+table+'?select='+ (table==='users'?'id':'user_id')+'&'+filter,{token});
  const data=await json(response,'Protected read');
  requireThat(Array.isArray(data),'Unexpected row response');return data;
 }
 function own(data,id,column){requireThat(data.length===1&&data[0]?.[column]===id,'Own fixture row missing');}
 async function denied(path,token){
  const response=await call(path,{token});
  // Do not treat network failures, missing tables, 5xx, or invalid JSON as denial.
  if(response.status===401||response.status===403)return;
  const data=await json(response,'Denied read');
  requireThat(Array.isArray(data)&&data.length===0,'Protected data visible');
 }
 const [a,b]=accounts;
 let report;
 try{
  const tokenA=await login(a),tokenA2=await login(a),tokenB=await login(b);
  requireThat(tokenA!==tokenA2,'Independent sessions required');
  own(await rows('users',tokenA,'id=eq.'+a.id),a.id,'id');
  own(await rows('users',tokenB,'id=eq.'+b.id),b.id,'id');
  // Profiles may be intentionally public to authenticated users; private
  // preference rows are the actual cross-user privacy assertion.
  own(await rows('runner_stats_preferences',tokenA,'user_id=eq.'+a.id),a.id,'user_id');
  own(await rows('runner_stats_preferences',tokenB,'user_id=eq.'+b.id),b.id,'user_id');
  const prefs='/rest/v1/runner_stats_preferences?select=user_id&user_id=eq.';
  await denied(prefs+b.id,tokenA);
  await denied(prefs+a.id,tokenB);
  await denied(prefs+a.id,undefined);
  await logout(tokenA);
  // Explicitly reuse the revoked bearer, not the SDK's cleared session.
  await denied(prefs+a.id,tokenA);
  await denied('/rest/v1/users?select=id&id=eq.'+a.id,tokenA);
  own(await rows('runner_stats_preferences',tokenA2,'user_id=eq.'+a.id),a.id,'user_id');
  own(await rows('runner_stats_preferences',tokenB,'user_id=eq.'+b.id),b.id,'user_id');
  await logout(tokenA2);await logout(tokenB);
  report={passwordSignIn:true,privateOwnRows:true,crossAccountDenied:true,guestDenied:true,
   revokedBearerDenied:true,independentSessionRetained:true,localLogout:true};
 }finally{
  // Attempt cleanup of only sessions created by this run, including failed runs.
  let failed=false;
  for(const token of live){try{await logout(token);}catch{failed=true;}}
  requireThat(!failed,'Test session cleanup not confirmed');
 }
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 // Fixed, non-sensitive error messages; never log response bodies or credentials.
 try{console.log(JSON.stringify(await runAuthSmoke(readConfig(process.env))));}
 catch{console.error('Auth API smoke failed; verify synthetic fixtures, RLS, logout and connectivity.');process.exitCode=1;}
}
