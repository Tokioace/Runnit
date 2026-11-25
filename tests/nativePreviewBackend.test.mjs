import test from 'node:test';
import assert from 'node:assert/strict';
import {previewEnvironment,checkTestBackend} from '../scripts/build-native-preview-web.mjs';
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
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  assert.equal(options.headers.apikey,config.VITE_SUPABASE_ANON_KEY);
  assert.ok(options.signal);return {ok:true};
 });
 await assert.rejects(checkTestBackend(config,async()=>({ok:false})),/rejected/);
 await assert.rejects(checkTestBackend(config,async()=>{throw Error('private details');}),/unreachable/);
});
