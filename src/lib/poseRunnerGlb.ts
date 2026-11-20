/**
 * Turns the CC0 Quaternius Superhero Male bind/T pose into a relaxed
 * standing pose by rotating its existing skinned skeleton joints.
 *
 * This touches glTF node rotation data only: meshes, skin weights and
 * inverse bind matrices are kept byte-for-byte. No third-party parser.
 */
type V3 = [number, number, number];
type Q = [number, number, number, number];
type Node = {
  name?: string;
  children?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
  matrix?: number[];
};
type Document = { nodes?: Node[]; skins?: unknown[] };
type Frame = { p: V3; r: Q; s: V3 };
const ZERO: V3 = [0, 0, 0];
const ONE: V3 = [1, 1, 1];
const IDENT: Q = [0, 0, 0, 1];
const vec = (a: number[]): V3 => [a[0] || 0, a[1] || 0, a[2] || 0];
const minus = (a: V3,b: V3): V3 => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const plus = (a: V3,b: V3): V3 => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const cross = (a: V3,b: V3): V3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot = (a: V3,b: V3): number => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const mag = (a: V3): number => Math.hypot(...a);
const unit = (a: V3): V3 => {
  const n=mag(a);
  if(n<1e-8)throw new Error('Skeleton has zero-length limb');
  return [a[0]/n,a[1]/n,a[2]/n];
};
const normQ=(q:Q):Q=>{
  const s=Math.hypot(...q);
  if(s<1e-8)throw new Error('Invalid skeleton quaternion');
  return [q[0]/s,q[1]/s,q[2]/s,q[3]/s];
};
const mulQ=(a:Q,b:Q):Q => [
  a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
  a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
  a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
  a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2],
];
const inverseQ=(q:Q):Q=>[-q[0],-q[1],-q[2],q[3]];
const rotate=(q:Q,v:V3):V3=>{
  const qv:V3=[q[0],q[1],q[2]];
  const t=cross(qv,v).map(x=>x*2) as V3;
  const u=cross(qv,t);
  return [v[0]+q[3]*t[0]+u[0],v[1]+q[3]*t[1]+u[1],v[2]+q[3]*t[2]+u[2]];
};
const between=(a:V3,b:V3):Q=>{
  const from=unit(a),to=unit(b),d=dot(from,to);
  if(d>0.99999)return [...IDENT];
  if(d<-.99999){
    const axis=unit(cross(from,Math.abs(from[1])<.8?[0,1,0]:[1,0,0]));
    return [axis[0],axis[1],axis[2],0];
  }
  const axis=cross(from,to);
  return normQ([axis[0],axis[1],axis[2],1+d]);
};
function getTransform(node:Node):Frame{
  if(node.matrix){
    const m=node.matrix;
    if(m.length!==16)throw new Error('Invalid glTF transform matrix');
    const s:V3=[Math.hypot(m[0],m[1],m[2]),Math.hypot(m[4],m[5],m[6]),Math.hypot(m[8],m[9],m[10])];
    const a=m[0]/s[0],b=m[4]/s[1],c=m[8]/s[2];
    const d=m[1]/s[0],e=m[5]/s[1],f=m[9]/s[2];
    const g=m[2]/s[0],h=m[6]/s[1],i=m[10]/s[2];
    const trace=a+e+i;
    let q:Q;
    if(trace>0){const w=Math.sqrt(1+trace)*2;q=[(h-f)/w,(c-g)/w,(d-b)/w,w/4];}
    else if(a>e&&a>i){const w=Math.sqrt(1+a-e-i)*2;q=[w/4,(b+d)/w,(c+g)/w,(h-f)/w];}
    else if(e>i){const w=Math.sqrt(1+e-a-i)*2;q=[(b+d)/w,w/4,(f+h)/w,(c-g)/w];}
    else {const w=Math.sqrt(1+i-a-e)*2;q=[(c+g)/w,(f+h)/w,w/4,(d-b)/w];}
    return {p:[m[12],m[13],m[14]],s,r:normQ(q)};
  }
  return {p:node.translation?vec(node.translation):[...ZERO],
    r:node.rotation?normQ(node.rotation as Q):[...IDENT],
    s:node.scale?vec(node.scale):[...ONE]};
}
function relaxNodes(doc:Document):void{
  const nodes=doc.nodes;
  if(!nodes?.length||!doc.skins?.length)throw new Error('Not a skinned humanoid GLB');
  if(nodes.length>4096)throw new Error('Unusually large skeleton');
  const parents=new Array<number>(nodes.length).fill(-1);
  for(let i=0;i<nodes.length;i++){
    for(const c of nodes[i].children||[]){
      if(!Number.isInteger(c)||c<0||c>=nodes.length)throw new Error('Invalid skeleton child');
      parents[c]=i;
    }
  }
  const byName=new Map(nodes.map((node,i)=>[node.name?.toLowerCase()||'',i]));
  const parentFrame=(i:number):Frame=>{
    const parent=parents[i];
    return parent<0?{p:[...ZERO],r:[...IDENT],s:[...ONE]}:worldFrame(parent);
  };
  const worldFrame=(i:number):Frame=>{
    // Model is known to contain a shallow humanoid hierarchy; guard cycles.
    const path:number[]=[];
    let cursor=i;
    while(cursor>=0){
      if(path.includes(cursor)||path.length>256)throw new Error('Cyclic skeleton hierarchy');
      path.unshift(cursor);
      cursor=parents[cursor];
    }
    let frame:Frame={p:[...ZERO],r:[...IDENT],s:[...ONE]};
    for(const idx of path){
      const local=getTransform(nodes[idx]);
      const offset:V3=[local.p[0]*frame.s[0],local.p[1]*frame.s[1],local.p[2]*frame.s[2]];
      frame={p:plus(frame.p,rotate(frame.r,offset)),r:normQ(mulQ(frame.r,local.r)),
        s:[frame.s[0]*local.s[0],frame.s[1]*local.s[1],frame.s[2]*local.s[2]]};
    }
    return frame;
  };
  const relax=(a:string,b:string,shoulder:boolean)=>{
    const i=byName.get(a),j=byName.get(b);
    if(i===undefined||j===undefined)throw new Error('Missing humanoid joint: '+a+' / '+b);
    const start=worldFrame(i),end=worldFrame(j);
    const limb=unit(minus(end.p,start.p));
    const sign=limb[0]>=0?1:-1;
    const target=shoulder?
      unit([sign*.14,-.98,.12]):unit([sign*.055,-.96,.26]);
    const worldDelta=between(limb,target);
    const parent=parentFrame(i);
    const desiredWorld=mulQ(worldDelta,start.r);
    const localRotation=normQ(mulQ(inverseQ(parent.r),desiredWorld));
    if(nodes[i].matrix)throw new Error('Bone matrix cannot be safely reposed');
    nodes[i].rotation=localRotation;
  };
  for(const side of ['l','r']){
    relax('upperarm_'+side,'lowerarm_'+side,true);
    relax('lowerarm_'+side,'hand_'+side,false);
  }
}
export function poseRunnerGlb(buffer:ArrayBuffer):ArrayBuffer{
  if(buffer.byteLength>16*1024*1024||buffer.byteLength<20)throw new Error('GLB size out of bounds');
  const d=new DataView(buffer);
  if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||
    d.getUint32(8,true)!==buffer.byteLength)throw new Error('Invalid GLB header');
  let p=12;
  const chunks:{type:number;data:Uint8Array}[]=[];
  while(p<buffer.byteLength){
    if(p+8>buffer.byteLength)throw new Error('Truncated GLB chunk');
    const size=d.getUint32(p,true),type=d.getUint32(p+4,true);
    if(size>buffer.byteLength-p-8||size%4!==0)throw new Error('Invalid GLB chunk size');
    chunks.push({type,data:new Uint8Array(buffer,p+8,size)});
    p+=8+size;
  }
  if(chunks[0]?.type!==0x4e4f534a||chunks.length>4)throw new Error('Missing GLB JSON chunk');
  const json=JSON.parse(new TextDecoder().decode(chunks[0].data)) as Document;
  relaxNodes(json);
  const source=new TextEncoder().encode(JSON.stringify(json));
  const padded=(source.length+3)&~3;
  const length=12+chunks.reduce((sum,chunk,i)=>sum+8+(i===0?padded:chunk.data.length),0);
  const out=new ArrayBuffer(length);
  const view=new DataView(out),bytes=new Uint8Array(out);
  view.setUint32(0,0x46546c67,true);
  view.setUint32(4,2,true);
  view.setUint32(8,length,true);
  let cursor=12;
  for(let i=0;i<chunks.length;i++){
    const payload=i===0?source:chunks[i].data;
    const chunkLength=i===0?padded:payload.length;
    view.setUint32(cursor,chunkLength,true);
    view.setUint32(cursor+4,chunks[i].type,true);
    bytes.set(payload,cursor+8);
    if(i===0)bytes.fill(0x20,cursor+8+payload.length,cursor+8+chunkLength);
    cursor+=8+chunkLength;
  }
  return out;
}
