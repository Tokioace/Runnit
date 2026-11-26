import test from 'node:test';
import assert from 'node:assert/strict';
import {isUncertainGhostSave} from '../src/lib/ghostSaveResponse.ts';

const error={message:'Request failed'};
test('transport and gateway failures never authorize a blind insert retry',()=>{
 for(const status of [0,408,499,500,502,503,504,599,NaN,Infinity,200,302]){
  assert.equal(isUncertainGhostSave(status,error),true,String(status));
 }
});
test('ordinary explicit client rejections retain the retry path',()=>{
 for(const status of [400,401,403,404,409,422,429]){
  assert.equal(isUncertainGhostSave(status,error),false,String(status));
 }
});
test('only a successful HTTP response without an error confirms the save',()=>{
 for(const status of [200,201,204]) assert.equal(isUncertainGhostSave(status,null),false);
 for(const status of [0,199,302,400,500,NaN]) assert.equal(isUncertainGhostSave(status,null),true,String(status));
});
