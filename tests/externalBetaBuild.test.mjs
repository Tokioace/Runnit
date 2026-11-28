import test from 'node:test';
import assert from 'node:assert/strict';
import { assertExternalBetaBuild } from '../src/lib/externalBetaBuild.ts';

const ref='abcdefghijklmnopqrst';
const system={RUNNIT_EXTERNAL_BETA:'true',VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'develop',VERCEL_GIT_COMMIT_SHA:'a'.repeat(40),RUNNIT_EXTERNAL_BETA_PROJECT_REF:ref,RUNNIT_EXTERNAL_BETA_ISOLATION_CONFIRMED:'true'};
const page={title:'Synthetic test',sections:[{heading:'Test',body:'Synthetic test content only.'}]};
const publicEnv={VITE_SUPABASE_URL:'https://'+ref+'.supabase.co',VITE_SUPABASE_ANON_KEY:'sb_publishable_synthetic_example_12345',VITE_LEGAL_PAGES_ENABLED:'true',VITE_APPROVED_LEGAL_PAGES_JSON:JSON.stringify({version:'synthetic-test',privacy:page,terms:page,imprint:page})};

test('ordinary builds remain unchanged and external beta flags fail closed',()=>{
 for(const flag of [undefined,'','false']) assert.doesNotThrow(()=>assertExternalBetaBuild({RUNNIT_EXTERNAL_BETA:flag},{}));
 for(const flag of ['TRUE','yes','1']) assert.throws(()=>assertExternalBetaBuild({RUNNIT_EXTERNAL_BETA:flag},{}),/Invalid external beta flag/);
 assert.doesNotThrow(()=>assertExternalBetaBuild(system,publicEnv));
});
test('external beta requires an exact identified develop preview',()=>{
 for(const changes of [{VERCEL_ENV:'production'},{VERCEL_ENV:undefined},{VERCEL_GIT_COMMIT_REF:'main'},{VERCEL_GIT_COMMIT_SHA:'unknown'}])
  assert.throws(()=>assertExternalBetaBuild({...system,...changes},publicEnv),/identified develop preview/);
});
test('external beta rejects known production, different project, malformed URL and private keys',()=>{
 const production='fcbffqcmvgdojsdfwgyt';
 assert.throws(()=>assertExternalBetaBuild({...system,RUNNIT_EXTERNAL_BETA_PROJECT_REF:production},{...publicEnv,VITE_SUPABASE_URL:'https://'+production+'.supabase.co'}),/nonproduction project/);
 for(const url of ['https://zyxwvutsrqponmlkjihg.supabase.co','http://'+ref+'.supabase.co','https://'+ref+'.supabase.co/','https://'+ref+'.supabase.co.evil.invalid'])
  assert.throws(()=>assertExternalBetaBuild(system,{...publicEnv,VITE_SUPABASE_URL:url}),/nonproduction project/);
 for(const key of [undefined,'legacy-jwt','sb_secret_synthetic_example_12345'])
  assert.throws(()=>assertExternalBetaBuild(system,{...publicEnv,VITE_SUPABASE_ANON_KEY:key}),/publishable key/);
});
test('external beta requires confirmed isolation and structurally valid enabled legal pages',()=>{
 assert.throws(()=>assertExternalBetaBuild({...system,RUNNIT_EXTERNAL_BETA_ISOLATION_CONFIRMED:undefined},publicEnv),/isolation must be confirmed/);
 for(const changes of [{VITE_LEGAL_PAGES_ENABLED:'false'},{VITE_APPROVED_LEGAL_PAGES_JSON:'broken'},{VITE_APPROVED_LEGAL_PAGES_JSON:undefined}])
  assert.throws(()=>assertExternalBetaBuild(system,{...publicEnv,...changes}),/approved legal pages/);
 assert.throws(()=>assertExternalBetaBuild(system,{...publicEnv,VITE_IOS_PREVIEW_SMOKE:'true'}),/Native smoke mode/);
});
