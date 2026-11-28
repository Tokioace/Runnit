// Build-time guard only. Never output credentials or accept admin keys.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRODUCTION_REF='fcbffqcmvgdojsdfwgyt';
export function previewEnvironment(env){
 const mode=env.RUNNIT_NATIVE_BACKEND_MODE||'offline';
 if(mode!=='offline'&&mode!=='test')throw Error('Unknown native preview backend mode');
 const flags={
  VITE_ACCOUNT_DELETION_REQUESTS_ENABLED:'false',
  VITE_LEGAL_PAGES_ENABLED:'false',
  VITE_IOS_PREVIEW_SMOKE:'true',
 };
 if(mode==='offline')return {...flags,VITE_SUPABASE_URL:'https://runnit-preview.invalid',VITE_SUPABASE_ANON_KEY:'preview-not-a-real-key'};
 if(env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_REF!=='refs/heads/develop')
  throw Error('Connected preview requires manual develop workflow');
 const ref=env.RUNNIT_NATIVE_TEST_REF;
 const key=env.RUNNIT_NATIVE_TEST_PUBLISHABLE_KEY;
 if(typeof ref!=='string'||!(/^[a-z]{20}$/).test(ref)||ref===PRODUCTION_REF)
  throw Error('A distinct, approved test project reference is required');
 if(env.RUNNIT_NATIVE_TEST_DATA_CONFIRMED!=='synthetic-only')
  throw Error('Synthetic-only test project confirmation missing');
 if(typeof key!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{16,128}$/.test(key))
  throw Error('Only a Supabase publishable key is allowed');
 return {...flags,VITE_SUPABASE_URL:'https://'+ref+'.supabase.co',VITE_SUPABASE_ANON_KEY:key};
}
function isApprovedTestConfig(config){
 return typeof config?.VITE_SUPABASE_URL==='string'&&
  /^https:\/\/[a-z]{20}\.supabase\.co$/.test(config.VITE_SUPABASE_URL)&&
  config.VITE_SUPABASE_URL!=='https://'+PRODUCTION_REF+'.supabase.co'&&
  typeof config.VITE_SUPABASE_ANON_KEY==='string'&&
  /^sb_publishable_[A-Za-z0-9_-]{16,128}$/.test(config.VITE_SUPABASE_ANON_KEY);
}
export async function checkTestBackend(config,request=fetch){
 if(!isApprovedTestConfig(config))throw Error('Invalid test backend configuration');
 // Read-only Auth settings endpoint; this validates API reachability, not RLS
 // or whether the operator actually populated the approved project safely.
 let response;
 try{
  response=await request(config.VITE_SUPABASE_URL+'/auth/v1/settings',{
   method:'GET',headers:{apikey:config.VITE_SUPABASE_ANON_KEY},
   redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)
  });
 }catch{throw Error('Test backend unreachable');}
 if(!response.ok)throw Error('Test backend rejected public credential');
}
// Inspect the actual build output, not only the environment supplied to Vite.
export function verifyPreviewBundle(directory,config){
 const offline=config?.VITE_SUPABASE_URL==='https://runnit-preview.invalid'&&config?.VITE_SUPABASE_ANON_KEY==='preview-not-a-real-key';
 if(!offline&&!isApprovedTestConfig(config))throw Error('Invalid preview backend configuration');
 const root=lstatSync(directory);
 if(!root.isDirectory()||root.isSymbolicLink())throw Error('Invalid preview output directory');
 if(!lstatSync(join(directory,'index.html')).isFile())throw Error('Missing preview entry');
 let hasUrl=false,hasKey=false;
 function walk(folder){
  for(const entry of readdirSync(folder,{withFileTypes:true})){
   const file=join(folder,entry.name);
   if(entry.isSymbolicLink())throw Error('Linked preview asset forbidden');
   if(entry.isDirectory()){walk(file);continue;}
   if(!entry.isFile())throw Error('Invalid preview asset');
   const bytes=readFileSync(file);
   if(bytes.includes(PRODUCTION_REF))throw Error('Production project reference found in preview');
   // Expected configuration alone is not enough: another embedded project
   // URL or private credential can coexist with it in a stale/mixed build.
   const content=bytes.toString('utf8');
   for(const match of content.matchAll(/https?:\/\/[a-z0-9]{20}\.supabase\.co\b/gi)){
    if(match[0]!==config.VITE_SUPABASE_URL)throw Error('Unexpected Supabase project URL in preview');
   }
   if(/\bsb_secret_[A-Za-z0-9_-]{16,}\b/.test(content))throw Error('Private Supabase key found in preview');
   for(const match of content.matchAll(/\bsb_publishable_[A-Za-z0-9_-]{16,}/g)){
    if(match[0]!==config.VITE_SUPABASE_ANON_KEY)throw Error('Unexpected Supabase publishable key in preview');
   }
   if(/\.(?:js|mjs)$/.test(entry.name)){
    hasUrl ||= bytes.includes(config.VITE_SUPABASE_URL);
    hasKey ||= bytes.includes(config.VITE_SUPABASE_ANON_KEY);
   }
  }
 }
 walk(directory);
 if(!hasUrl||!hasKey)throw Error('Expected preview backend configuration missing from JavaScript');
}
async function main(){
 const config=previewEnvironment(process.env);
 if(process.env.RUNNIT_NATIVE_BACKEND_MODE==='test')await checkTestBackend(config);
 // Do not pass build credential source variables into the build subprocess.
 const env={...process.env,...config};
 for(const key of Object.keys(env))if(key.startsWith('RUNNIT_NATIVE_TEST_'))delete env[key];
 const run=spawnSync('npm',['run','build'],{env,stdio:'inherit'});
 if(run.error||run.status!==0)throw Error('Native preview web build failed');
 try{verifyPreviewBundle('dist',config);}
 catch{throw Error('Native preview output validation failed; check expected backend and readable assets');}
 console.log('Preview output contains expected backend configuration and no known production reference.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
