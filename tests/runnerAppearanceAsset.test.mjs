import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { poseRunnerGlb } from '../src/lib/poseRunnerGlb.ts';
const asset = new URL('../public/assets/runnit-runner-3d.glb', import.meta.url);
const file = readFileSync(asset);
function documentFrom(buffer) {
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.equal(view.getUint32(0,true),0x46546c67);
  assert.equal(view.getUint32(4,true),2);
  assert.equal(view.getUint32(8,true),bytes.byteLength);
  const jsonBytes=view.getUint32(12,true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+jsonBytes)));
  const binOffset=20+jsonBytes+8;
  assert.equal(view.getUint32(binOffset-4,true),0x004e4942);
  return {json,bin:bytes.subarray(binOffset)};
}
test('RUNNIT 3D avatar is a real, self-hosted and valid skinned GLB',()=>{
  const {json,bin}=documentFrom(file);
  assert.ok(file.byteLength>150000 && file.byteLength<3000000);
  assert.ok(json.skins[0].joints.length>=60);
  assert.ok(json.meshes.length>=4);
  assert.ok(json.nodes.some(n=>n.name?.includes('RUNNIT runner accessories')));
  assert.ok(json.materials.some(m=>m.name==='Dark brown spiked hair'));
  assert.ok(json.materials.some(m=>m.name==='Reflective electric blue lenses'));
  assert.ok(json.materials.some(m=>m.name==='RUNNIT white logo'));
  assert.ok(json.materials.some(m=>m.name==='White sneaker upper'));
  for(const bv of json.bufferViews){
    assert.ok((bv.byteOffset||0)+(bv.byteLength||0)<=bin.byteLength);
  }
  for(const mesh of json.meshes)for(const primitive of mesh.primitives){
    const acc=json.accessors[primitive.attributes.POSITION];
    assert.ok(acc.min&&acc.max, 'POSITION accessor must include 3D bounds');
    assert.ok(acc.count>0);
  }
});
test('avatar uses different vertex colors for skin, navy clothing and cyan accents',()=>{
  const {json,bin}=documentFrom(file);
  const body=json.meshes[2].primitives[0], a=json.accessors[body.attributes.COLOR_0];
  assert.equal(a.componentType,5121);
  assert.equal(a.type,'VEC4');
  assert.equal(a.normalized,true);
  const bv=json.bufferViews[a.bufferView];
  const start=(bv.byteOffset||0)+(a.byteOffset||0);
  const stride=bv.byteStride||4;
  const colors=new Set();
  for(let i=0;i<a.count;i++){
    const pos=start+i*stride;
    colors.add(Array.from(bin.subarray(pos,pos+3)).join(','));
  }
  assert.ok(colors.size>=6, '3D body must have varied clothing and skin colors');
  const model=readFileSync(new URL('../src/components/profile/RunnerHologramModel.tsx', import.meta.url),'utf8');
  assert.match(model,/RUNNER_MODEL_URL = '\/assets\/runnit-runner-3d\.glb'/);
  assert.doesNotMatch(model,/RUNNER_MODEL_URL = 'https:/);
  assert.doesNotMatch(model,/setBaseColorFactor\?\.\(\[0\.04, 0\.78/);
});
test('customized avatar survives relaxing the real rigged arm bones',()=>{
  const input=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
  const output=poseRunnerGlb(input);
  const {json}=documentFrom(output);
  assert.ok(json.nodes.some(n=>n.name==='RUNNIT runner accessories (head, chest, shoes skinned)'));
  assert.equal(json.skins[0].joints.length,65);
  assert.ok(json.nodes.find(n=>n.name==='upperarm_l')?.rotation);
  assert.ok(json.nodes.find(n=>n.name==='upperarm_r')?.rotation);
});
