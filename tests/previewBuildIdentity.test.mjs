import test from 'node:test';
import assert from 'node:assert/strict';
import { previewBuildIdentity, matchesPreviewBuildIdentity } from '../src/lib/previewBuildIdentity.ts';
const commit = 'a'.repeat(40);
const env = { VERCEL_ENV:'preview', VERCEL_GIT_COMMIT_REF:'develop', VERCEL_GIT_COMMIT_SHA:commit };
test('only a valid develop preview emits a minimal identity',()=>{
 const result=previewBuildIdentity({...env,VITE_SUPABASE_ANON_KEY:'synthetic-secret',VERCEL_URL:'example.invalid'});
 assert.deepEqual(result,{schema:'runnit-preview-build-v1',branch:'develop',commit});
 for(const changes of [{VERCEL_ENV:'production'},{VERCEL_ENV:undefined},{VERCEL_GIT_COMMIT_REF:'main'},{VERCEL_GIT_COMMIT_REF:undefined},{VERCEL_GIT_COMMIT_SHA:'a'.repeat(39)},{VERCEL_GIT_COMMIT_SHA:'A'.repeat(40)},{VERCEL_GIT_COMMIT_SHA:undefined},{VERCEL_GIT_COMMIT_SHA:commit+'\n'}])
  assert.equal(previewBuildIdentity({...env,...changes}),null);
});
test('the exact commit and complete minimal report must match',()=>{
 const value=previewBuildIdentity(env);
 assert.equal(matchesPreviewBuildIdentity(value,commit),true);
 for(const bad of [null,[],{},'html',{...value,branch:'main'},{...value,commit:'b'.repeat(40)},{...value,token:'unexpected'},{schema:value.schema,commit}])
  assert.equal(matchesPreviewBuildIdentity(bad,commit),false);
 assert.equal(matchesPreviewBuildIdentity(value,'b'.repeat(40)),false);
 assert.equal(matchesPreviewBuildIdentity(value,undefined),false);
});
