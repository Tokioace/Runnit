import test from 'node:test';
import assert from 'node:assert/strict';
import {processTestErasure,validateTestTarget} from '../scripts/account-erasure-core.mjs';
const userId='00000000-0000-4000-8000-000000000011';
const ref='aaaaaaaaaaaaaaaaaaaa',url='https://'+ref+'.supabase.co';
const expectedEmail='runnit-test-erasure@example.invalid';
const opts={ref,url,userId,expectedEmail,syntheticOnly:'synthetic-only'};
function mock({request=true,active=0,gate=true,provider='email',residual=false,failDelete=false,email=expectedEmail,anonymous=false}={}){
 let deleted=false,calls=0;
 const client={auth:{admin:{
   getUserById:async()=>deleted?{error:{status:404}}:{data:{user:{id:userId,email,is_anonymous:anonymous,email_confirmed_at:'2026-11-25',identities:[{provider}]}}},
   deleteUser:async(id,soft)=>{calls++;assert.equal(id,userId);assert.equal(soft,false);if(failDelete)return {error:{status:500}};deleted=true;return {data:{}};}
 }},rpc:async()=>({data:gate}),from(table){
   let matched=false;
   const query={select(){return this},eq(col,val){if(col==='status')matched=true;return this},or(){return this},
     maybeSingle:async()=>({data:request?{user_id:userId,requested_at:'2026-11-25T12:00:00Z'}:null}),
     then(resolve){return Promise.resolve({count:matched?active:deleted?(residual&&table==='users'?1:0):table==='users'||table==='account_deletion_requests'?1:0}).then(resolve)}};
   return query;
 }};
 return {client,calls:()=>calls};
}
test('production and mismatched URL always blocked',()=>{
 assert.throws(()=>validateTestTarget('https://fcbffqcmvgdojsdfwgyt.supabase.co','fcbffqcmvgdojsdfwgyt',userId));
 assert.throws(()=>validateTestTarget('https://other.example',ref,userId));
});
test('dry run checks prerequisites without deleting',async()=>{
 const m=mock();assert.equal((await processTestErasure(m.client,opts)).status,'dry-run');assert.equal(m.calls(),0);
});
test('missing request, active duel, missing schema and OAuth block deletion',async()=>{
 for(const options of [{request:false},{active:1},{gate:false},{provider:'apple'}]){
   const m=mock(options);await assert.rejects(processTestErasure(m.client,{...opts,execute:true,confirmation:'DELETE SYNTHETIC '+userId}));assert.equal(m.calls(),0);
 }
 const m=mock();await assert.rejects(processTestErasure(m.client,{...opts,execute:true}));assert.equal(m.calls(),0);
});
test('confirmed synthetic deletion verifies all tables and requires notification',async()=>{
 const m=mock();const result=await processTestErasure(m.client,{...opts,execute:true,confirmation:'DELETE SYNTHETIC '+userId});
 assert.equal(result.status,'verified-test-erasure');assert.equal(result.notificationRequired,true);assert.equal(m.calls(),1);
 assert.ok(Object.values(result.counts).every(n=>n===0));
});
test('failed admin response or remaining records cannot report completion',async()=>{
 for(const options of [{failDelete:true},{residual:true}]){
   const m=mock(options);await assert.rejects(processTestErasure(m.client,{...opts,execute:true,confirmation:'DELETE SYNTHETIC '+userId}));assert.equal(m.calls(),1);
 }
});

test('erasure requires explicit synthetic project confirmation and matching synthetic email',async()=>{
 for(const patch of [{syntheticOnly:undefined},{syntheticOnly:'production'},{expectedEmail:undefined},{expectedEmail:'ordinary@example.invalid'},{expectedEmail:'runnit-test-other@example.invalid'}]){
  const m=mock();await assert.rejects(processTestErasure(m.client,{...opts,...patch,execute:true,confirmation:'DELETE SYNTHETIC '+userId}));assert.equal(m.calls(),0);
 }
 for(const config of [{email:'ordinary@example.invalid'},{email:null},{anonymous:true}]){
  const m=mock(config);await assert.rejects(processTestErasure(m.client,{...opts,execute:true,confirmation:'DELETE SYNTHETIC '+userId}));assert.equal(m.calls(),0);
 }
 const m=mock({email:expectedEmail.toUpperCase()});assert.equal((await processTestErasure(m.client,opts)).status,'dry-run');assert.equal(m.calls(),0);
});
