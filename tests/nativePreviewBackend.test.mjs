import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {previewEnvironment,checkTestBackend,verifyPreviewBundle} from '../scripts/build-native-preview-web.mjs';
const testEnv={RUNNIT_NATIVE_BACKEND_MODE:'test',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/develop',RUNNIT_NATIVE_TEST_REF:'abcdefghijklmnopqrst',RUNNIT_NATIVE_TEST_PUBLISHABLE_KEY:'sb_publishable_synthetic_test_key_123456',RUNNIT_NATIVE_TEST_DATA_CONFIRMED:'synthetic-only'};
test('default build uses offline preview even if other test variables exist',()=>{
 const out=previewEnvironment({...testEnv,RUNNIT_NATIVE_BACKEND_MODE:'offline'});
 assert.equal(out.VITE_SUPABASE_URL,'https://runnit-preview.invalid');
 assert.equal(out.VITE_SUPABASE_ANON_KEY,'preview-not-a-real-key');
 assert.equal(out.VITE_ACCOUNT_DELETION_REQUESTS_ENABLED,'false');
 assert.equal(out.VITE_LEGAL_PAGES_ENABLED,'false');
});
test('only manual develop build with explicit test project and public key connects',()=>{
 const out=previewEnvironment(testEnv);
 assert.equal(out.VITE_SUPABASE_URL,'https://abcdefghijklmnopqrst.supabase.co');
 assert.equal(out.VITE_SUPABASE_ANON_KEY,testEnv.RUNNIT_NATIVE_TEST_PUBLISHABLE_KEY);
 for(const change of [{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REF:'refs/heads/main'},{RUNNIT_NATIVE_TEST_REF:'fcbffqcmvgdojsdfwgyt'},{RUNNIT_NATIVE_TEST_REF:'https://example.org'},{RUNNIT_NATIVE_TEST_REF:''},{RUNNIT_NATIVE_TEST_DATA_CONFIRMED:''},{RUNNIT_NATIVE_TEST_PUBLISHABLE_KEY:'sb_secret_synthetic_not_a_public_key'},{RUNNIT_NATIVE_TEST_PUBLISHABLE_KEY:'eyJ.legacy.token'},{RUNNIT_NATIVE_TEST_PUBLISHABLE_KEY:'sb_publishable_bad\nkey'},{RUNNIT_NATIVE_BACKEND_MODE:'production'}])
   assert.throws(()=>previewEnvironment({...testEnv,...change}));
});
test('backend preflight is a bounded read-only Auth settings request without redirects',async()=>{
 const config=previewEnvironment(testEnv);
 await checkTestBackend(config,async(url,options)=>{
  assert.equal(url,'https://abcdefghijklmnopqrst.supabase.co/auth/v1/settings');
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  assert.equal(options.headers.apikey,config.VITE_SUPABASE_ANON_KEY);
  assert.ok(options.signal);return {ok:true};
 });
 await assert.rejects(checkTestBackend(config,async()=>({ok:false})),/rejected/);
 await assert.rejects(checkTestBackend(config,async()=>{throw Error('private details');}),/unreachable/);
});

function bundleFixture(t,config){
 const dir=mkdtempSync(join(tmpdir(),'runnit-preview-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 mkdirSync(join(dir,'assets'));
 writeFileSync(join(dir,'index.html'),'<html></html>');
 const js=join(dir,'assets','index.js');
 writeFileSync(js,JSON.stringify([config.VITE_SUPABASE_URL,config.VITE_SUPABASE_ANON_KEY]));
 return {dir,js};
}
test('actual preview bundle includes expected offline or approved test configuration',t=>{
 for(const config of [previewEnvironment({}),previewEnvironment(testEnv)]){
  const {dir}=bundleFixture(t,config);
  verifyPreviewBundle(dir,config);
 }
});
test('missing or incorrect backend config in JavaScript cannot pass',t=>{
 const config=previewEnvironment({});
 const {dir,js}=bundleFixture(t,config);
 for(const content of [config.VITE_SUPABASE_URL,config.VITE_SUPABASE_ANON_KEY,'unrelated bundle']){
  writeFileSync(js,content);
  assert.throws(()=>verifyPreviewBundle(dir,config),/Expected preview backend configuration/);
 }
 writeFileSync(join(dir,'fake.txt'),JSON.stringify(config));
 assert.throws(()=>verifyPreviewBundle(dir,config),/Expected preview backend configuration/);
});
test('known production reference in any bundled file fails',t=>{
 const config=previewEnvironment({});
 const {dir}=bundleFixture(t,config);
 writeFileSync(join(dir,'assets','extra.bin'),Buffer.from('fcbffqcmvgdojsdfwgyt'));
 assert.throws(()=>verifyPreviewBundle(dir,config),/Production project reference/);
});
test('missing output and linked assets fail closed',t=>{
 const config=previewEnvironment({});
 const {dir,js}=bundleFixture(t,config);
 assert.throws(()=>verifyPreviewBundle(join(dir,'missing'),config));
 symlinkSync(js,join(dir,'linked.js'));
 assert.throws(()=>verifyPreviewBundle(dir,config),/Linked preview asset/);
});


test('direct preflight rejects unapproved targets and credentials before network',async()=>{
 const config=previewEnvironment(testEnv);
 for(const patch of [
  {VITE_SUPABASE_URL:'https://fcbffqcmvgdojsdfwgyt.supabase.co'},
  {VITE_SUPABASE_URL:'https://example.invalid'},
  {VITE_SUPABASE_URL:config.VITE_SUPABASE_URL+'/extra'},
  {VITE_SUPABASE_ANON_KEY:'sb_secret_never'},
 ]){
  let calls=0;
  await assert.rejects(checkTestBackend({...config,...patch},async()=>{calls++;return {ok:true};}),/Invalid test backend configuration/);
  assert.equal(calls,0);
 }
});
test('bundle cannot be validated using a non-approved backend configuration',t=>{
 const config={VITE_SUPABASE_URL:'https://example.invalid',VITE_SUPABASE_ANON_KEY:'sb_secret_synthetic'};
 const {dir}=bundleFixture(t,config);
 assert.throws(()=>verifyPreviewBundle(dir,config),/Invalid preview backend configuration/);
});


test('mixed preview output with additional project URL or private key fails closed',t=>{
 const config=previewEnvironment(testEnv);
 const {dir,js}=bundleFixture(t,config);
 const expected=JSON.stringify([config.VITE_SUPABASE_URL,config.VITE_SUPABASE_ANON_KEY]);
 for(const [extra,reason] of [
  ['https://zyxwvutsrqponmlkjihg.supabase.co',/Unexpected Supabase project URL/],
  ['http://abcdefghijklmnopqrst.supabase.co',/Unexpected Supabase project URL/],
  ['sb_secret_'+ 'synthetic_example_123456789',/Private Supabase key/],
 ]){
  writeFileSync(js,expected+'\n'+JSON.stringify(extra));
  assert.throws(()=>verifyPreviewBundle(dir,config),reason);
 }
 writeFileSync(js,expected);
 verifyPreviewBundle(dir,config);
});
