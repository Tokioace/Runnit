import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { poseRunnerGlb } from '../src/lib/poseRunnerGlb.ts';

const file=readFileSync(new URL('../public/assets/runnit-runner-3d.glb',import.meta.url));
function read(buffer) {
 const b=new Uint8Array(buffer.buffer||buffer,buffer.byteOffset||0,buffer.byteLength||buffer.length);
 const d=new DataView(b.buffer,b.byteOffset,b.byteLength);
 assert.equal(d.getUint32(0,true),0x46546c67);
 assert.equal(d.getUint32(4,true),2);
 assert.equal(d.getUint32(8,true),b.length);
 const length=d.getUint32(12,true);
 const json=JSON.parse(new TextDecoder().decode(b.subarray(20,20+length)));
 const payload=b.subarray(20+length+8);
 return {json,payload};
}
test('Runnit runner v2 accessories have natural compact proportions',()=>{
 const {json}=read(file);
 const m=json.meshes[3].primitives;
 const pos=i=>json.accessors[m[i].attributes.POSITION];
 assert.ok(pos(0).max[1]<1.89,'Hair must not stand straight up');
 assert.ok(pos(1).max[1]<1.89,'Highlighted hair must be swept back');
 assert.ok(pos(2).max[2]<.165,'Visor must fit close to the face');
 assert.ok(pos(3).max[2]<.165,'Goggle frame must be slim');
 assert.ok(pos(8).max[2]<.20,'Sneakers must not have oversized toes');
 assert.ok(pos(8).max[1]<.12,'Sneakers must not be overly tall');
 assert.ok(pos(9).max[2]<.20,'Soles must be compact');
 for(const primitive of json.meshes.flatMap(m=>m.primitives)){
  const a=json.accessors[primitive.attributes.POSITION];
  assert.equal(a.min.length,3);
  assert.equal(a.max.length,3);
  assert.ok(a.max.every(Number.isFinite));
 }
});
test('Runnit shorts and leggings have distinct vertex color groups',()=>{
 const {json,payload}=read(file),primitive=json.meshes[2].primitives[0];
 const a=json.accessors[primitive.attributes.COLOR_0];
 const bv=json.bufferViews[a.bufferView];
 const offset=(bv.byteOffset||0)+(a.byteOffset||0),stride=bv.byteStride||4;
 const swatches=new Set();
 for(let i=0;i<a.count;i++){
  const at=offset+i*stride;
  swatches.add([payload[at],payload[at+1],payload[at+2]].join(','));
 }
 for(const color of ['12,23,42','11,15,27','12,123,158']){
  assert.ok(swatches.has(color),'Missing clothing swatch '+color);
 }
});
test('Runnit appearance remains a skinned, rotatable GLB',()=>{
 const body=poseRunnerGlb(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength));
 const {json}=read(new Uint8Array(body));
 assert.equal(json.skins[0].joints.length,65);
 assert.ok(json.meshes.length>=4);
 assert.ok(json.nodes.some(n=>n.name?.includes('RUNNIT runner accessories')));
});
