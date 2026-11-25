import test from 'node:test';
import assert from 'node:assert/strict';
import {runPreviewSmoke,shouldRunPreviewSmoke} from '../src/lib/nativePreviewSmoke.ts';
test('smoke enabled only by explicit preview flag on bundled origin',()=>{
 assert.equal(shouldRunPreviewSmoke('true','capacitor://localhost/'),true);
 for(const url of ['https://localhost/','https://runnit.example/','capacitor://evil.test/'])assert.equal(shouldRunPreviewSmoke('true',url),false);
 assert.equal(shouldRunPreviewSmoke(undefined,'capacitor://localhost/'),false);
});
function bridge(failRead=false,failPing=false){
 const values=new Map(),calls=[];
 return {values,calls,async nativePromise(plugin,method,options){
  calls.push(method);
  if(method==='previewPing'){assert.equal(plugin,'RunnitSensorProbe');return {ready:!failPing};}
  assert.equal(plugin,'RunnitSessionVault');
  if(method==='writeSession')values.set(options.key,options.value);
  if(method==='readSession')return {value:failRead&&values.size?'wrong':values.get(options.key)??null};
  if(method==='removeSession')values.delete(options.key);
  if(method==='previewSmokeComplete')assert.equal(values.size,0);
 }};
}
test('smoke marker requires native ping and write/read/delete/read',async()=>{
 const b=bridge();await runPreviewSmoke(b);
 assert.deepEqual(b.calls,['previewPing','writeSession','readSession','removeSession','readSession','previewSmokeComplete']);
 assert.equal(b.values.size,0);
});
test('failed synthetic round trip cleans up and never records success',async()=>{
 const b=bridge(true);await assert.rejects(runPreviewSmoke(b),/mismatch/);
 assert.equal(b.values.size,0);assert.ok(!b.calls.includes('previewSmokeComplete'));
 const p=bridge(false,true);await assert.rejects(runPreviewSmoke(p),/not ready/);
 assert.deepEqual(p.calls,['previewPing']);
});
