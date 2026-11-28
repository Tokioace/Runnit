import test from 'node:test';
import assert from 'node:assert/strict';
import {poseRunnerGlb} from '../src/lib/poseRunnerGlb.ts';

function packGlb(document) {
  const text = Buffer.from(JSON.stringify(document), 'utf8');
  const padded = (text.length + 3) & ~3;
  const out = Buffer.alloc(12 + 8 + padded, 0x20);
  out.write('glTF', 0, 'ascii');
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(padded, 12);
  out.write('JSON', 16, 'ascii');
  text.copy(out, 20);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}
function unpack(buffer) {
  const v = new DataView(buffer);
  return JSON.parse(new TextDecoder().decode(
    new Uint8Array(buffer, 20, v.getUint32(12, true)),
  ));
}
function move(q,v) {
  const [x,y,z,w] = q, [a,b,c] = v;
  const ux = 2*(y*c-z*b), uy=2*(z*a-x*c), uz=2*(x*b-y*a);
  return [
    a+w*ux+(y*uz-z*uy),
    b+w*uy+(z*ux-x*uz),
    c+w*uz+(x*uy-y*ux),
  ];
}
const source = {
  asset:{version:'2.0'},
  skins:[{joints:[1,2,3,4,5,6]}],
  nodes:[
    {name:'hips', children:[1,4]},
    {name:'upperarm_l',translation:[.3,1.25,0],children:[2]},
    {name:'lowerarm_l',translation:[.5,0,0],children:[3]},
    {name:'hand_l',translation:[.42,0,0]},
    {name:'upperarm_r',translation:[-.3,1.25,0],children:[5]},
    {name:'lowerarm_r',translation:[-.5,0,0],children:[6]},
    {name:'hand_r',translation:[-.42,0,0]},
  ],
};
test('posed GLB round-trips with a complete correct binary header', () => {
  const output = poseRunnerGlb(packGlb(source));
  const view = new DataView(output);
  assert.equal(view.getUint32(0,true),0x46546c67);
  assert.equal(view.getUint32(4,true),2);
  assert.equal(view.getUint32(8,true),output.byteLength);
  assert.equal(view.getUint32(12,true)%4,0);
  assert.ok(output.byteLength > 100);
  const obj = unpack(output);
  assert.equal(obj.skins[0].joints.length,6);
  assert.equal(obj.nodes.length,7);
});
test('upper arms lower naturally instead of staying in T-pose', () => {
  const nodes = unpack(poseRunnerGlb(packGlb(source))).nodes;
  const l = move(nodes[1].rotation, [.5,0,0]);
  const r = move(nodes[4].rotation, [-.5,0,0]);
  assert.ok(l[1]<-.35, 'left arm should point below the shoulder');
  assert.ok(r[1]<-.35, 'right arm should point below the shoulder');
  assert.ok(l[0]>0, 'left arm remains slightly away from torso');
  assert.ok(r[0]<0, 'right arm remains slightly away from torso');
  assert.ok(Array.isArray(nodes[2].rotation));
  assert.ok(Array.isArray(nodes[5].rotation));
});
test('unskinned, malformed and oversized data fails closed', () => {
  assert.throws(()=>poseRunnerGlb(new ArrayBuffer(12)),/bounds/);
  assert.throws(()=>poseRunnerGlb(packGlb({...source,skins:[]})),/skinned/);
  assert.throws(()=>poseRunnerGlb(packGlb({...source,nodes:source.nodes.slice(0,3)})),/Invalid skeleton child/);
});
