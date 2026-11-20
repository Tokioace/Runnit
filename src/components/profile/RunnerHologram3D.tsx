import { useEffect, useRef } from 'react';

/**
 * Real volumetric geometry rather than 2D billboard sprites. The body
 * mesh has width AND depth, so a side view keeps a legible silhouette.
 * Everything stays local to the canvas: no telemetry or permissions.
 */
type V = readonly [number, number, number];
type Quad = { corners: [V, V, V, V]; tint: number };
type P = { x: number; y: number; z: number };
const add = (a: V, b: V): V => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
const sub = (a: V, b: V): V => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const scale = (p: V, n: number): V => [p[0]*n, p[1]*n, p[2]*n];
const cross = (a: V, b: V): V =>
  [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
function unit(p: V): V {
  const len = Math.hypot(...p) || 1;
  return scale(p, 1/len);
}
const faces: Quad[] = [];
function ellipsoid(c: V, r: V, tint=0, rows=9, cols=14) {
  const v = (i: number, j: number): V => {
    const lat = -Math.PI/2 + i*Math.PI/rows;
    const lon = j*2*Math.PI/cols;
    return [
      c[0] + r[0]*Math.cos(lat)*Math.cos(lon),
      c[1] + r[1]*Math.sin(lat),
      c[2] + r[2]*Math.cos(lat)*Math.sin(lon),
    ];
  };
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++)
    faces.push({corners:[v(i,j),v(i,j+1),v(i+1,j+1),v(i+1,j)],tint});
}
function limb(a: V, b: V, radius: number, depth: number, tint=0, rows=7, cols=12) {
  const dir=unit(sub(b,a));
  const side=unit(cross(dir,[0,0,1]));
  const forward=unit(cross(side,dir));
  const v=(i:number,j:number): V => {
    const t=i/rows, theta=j*2*Math.PI/cols;
    const main=add(a,scale(sub(b,a),t));
    const taper=.78+.27*Math.sin(Math.PI*t);
    return add(main,add(
      scale(side,radius*taper*Math.cos(theta)),
      scale(forward,depth*taper*Math.sin(theta)),
    ));
  };
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++)
    faces.push({corners:[v(i,j),v(i,j+1),v(i+1,j+1),v(i+1,j)],tint});
}
/**
 * A continuous, anatomical loft rather than stacks of spherical joints.
 * The tapering torso and articulated limbs retain volume in profile.
 * Faces are static so all frames only project, sort and render the mesh.
 */
type Ring = { c: V; rx: number; rz: number };
function loft(rings: readonly Ring[], columns=16, tint=1) {
  const ordered=[...rings].sort((a,b)=>b.c[1]-a.c[1]);
  const vertex=(ring:Ring, j:number):V=>{
    const t=(2*Math.PI*j)/columns;
    return [ring.c[0]+ring.rx*Math.cos(t),ring.c[1],ring.c[2]+ring.rz*Math.sin(t)];
  };
  for(let i=0;i<ordered.length-1;i++)for(let j=0;j<columns;j++)
    faces.push({
      corners:[vertex(ordered[i],j),vertex(ordered[i],j+1),
        vertex(ordered[i+1],j+1),vertex(ordered[i+1],j)],
      tint,
    });
}
function swept(rings: readonly Ring[], columns=14, tint=1){
  // Tangent-derived bases keep sections perpendicular as limbs change direction.
  const vertex=(i:number,j:number):V=>{
    const p=rings[i];
    const near=rings[Math.max(0,i-1)].c;
    const far=rings[Math.min(rings.length-1,i+1)].c;
    const axis=unit(sub(far,near));
    const across=unit(cross(axis,[0,0,1]));
    const deep=unit(cross(across,axis));
    const angle=j*2*Math.PI/columns;
    return add(p.c,add(scale(across,p.rx*Math.cos(angle)),
      scale(deep,p.rz*Math.sin(angle))));
  };
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<columns;j++)
    faces.push({
      corners:[vertex(i,j),vertex(i,j+1),vertex(i+1,j+1),vertex(i+1,j)],
      tint,
    });
}
// Elliptical torso, narrowed waist and well-defined shoulder taper.
loft([
  {c:[0,1.19,0],rx:.135,rz:.125},
  {c:[0,1.12,0],rx:.17,rz:.145},
  {c:[0,1.05,-.006],rx:.29,rz:.195},
  {c:[0,.97,-.01],rx:.42,rz:.225},
  {c:[0,.86,-.016],rx:.455,rz:.275},
  {c:[0,.74,-.025],rx:.438,rz:.285},
  {c:[0,.61,-.023],rx:.392,rz:.258},
  {c:[0,.47,-.014],rx:.326,rz:.227},
  {c:[0,.31,0],rx:.292,rz:.214},
  {c:[0,.16,0],rx:.286,rz:.215},
  {c:[0,.025,-.003],rx:.326,rz:.235},
  {c:[0,-.13,-.015],rx:.345,rz:.252},
  {c:[0,-.26,-.01],rx:.29,rz:.205},
],18,1);
// A head with forehead, cheekbone and jaw — not a round floating egg.
loft([
  {c:[0,1.205,0],rx:.065,rz:.085},
  {c:[0,1.26,.007],rx:.13,rz:.14},
  {c:[0,1.36,.016],rx:.178,rz:.177},
  {c:[0,1.49,.01],rx:.218,rz:.198},
  {c:[0,1.62,0],rx:.224,rz:.202},
  {c:[0,1.75,-.01],rx:.205,rz:.194},
  {c:[0,1.84,-.015],rx:.145,rz:.14},
  {c:[0,1.89,0],rx:.045,rz:.05},
],18,2);
for(const sign of [-1,1] as const){
  // Smooth single surfaces connect each shoulder to a tapered wrist.
  swept([
    {c:[sign*.44,.96,0],rx:.18,rz:.175},
    {c:[sign*.51,.88,0],rx:.19,rz:.177},
    {c:[sign*.565,.76,.0],rx:.167,rz:.154},
    {c:[sign*.605,.57,.015],rx:.146,rz:.135},
    {c:[sign*.653,.39,.045],rx:.112,rz:.116},
    {c:[sign*.695,.19,.065],rx:.13,rz:.117},
    {c:[sign*.72,-.04,.086],rx:.113,rz:.104},
    {c:[sign*.735,-.19,.103],rx:.076,rz:.080},
    {c:[sign*.747,-.31,.11],rx:.089,rz:.081},
    {c:[sign*.747,-.405,.11],rx:.058,rz:.055},
  ],14,1);
  // Legs use the same uninterrupted mesh from hips to ankles.
  swept([
    {c:[sign*.205,-.18,-.015],rx:.207,rz:.20},
    {c:[sign*.214,-.38,.006],rx:.223,rz:.216},
    {c:[sign*.238,-.59,.016],rx:.207,rz:.190},
    {c:[sign*.263,-.78,.013],rx:.161,rz:.151},
    {c:[sign*.277,-.98,0],rx:.124,rz:.127},
    {c:[sign*.282,-1.14,-.014],rx:.156,rz:.144},
    {c:[sign*.288,-1.34,-.02],rx:.139,rz:.133},
    {c:[sign*.29,-1.53,.002],rx:.089,rz:.096},
    {c:[sign*.29,-1.65,.055],rx:.087,rz:.094},
  ],16,1);
  // Shoes are elongated, with the toe pointing forward, not big sphere feet.
  ellipsoid([sign*.29,-1.70,.14],[.153,.080,.24],2,7,12);
}
// Anatomical guide lines attach to the continuous surfaces, not extra spheres.
const contourLines: V[][] = [
  [[-.35,.82,.24],[-.18,.78,.28],[0,.76,.288],[.18,.78,.28],[.35,.82,.24]],
  [[0,.98,.19],[0,.65,.266],[0,.43,.226],[0,.22,.215]],
  [[-.22,.38,.16],[.22,.38,.16]],
  [[-.22,.15,.18],[.22,.15,.18]],
  [[-.19,-.08,.18],[.19,-.08,.18]],
  [[-.28,.83,-.2],[0,.76,-.28],[.28,.83,-.2]],
];
function project(v: V, angle: number, w: number, h: number): P {
  const ca=Math.cos(angle), sa=Math.sin(angle);
  const x=v[0]*ca+v[2]*sa;
  const z=v[2]*ca-v[0]*sa;
  const perspective=5.4/(5.4-z);
  const size=Math.min(w/2.08,h/3.9);
  return { x:w*.5+x*size*perspective,
    y:h*.485-v[1]*size*perspective,z };
}
function normalDepth(a:P,b:P,c:P):number {
  const ax=b.x-a.x, ay=b.y-a.y, bx=c.x-a.x, by=c.y-a.y;
  return ax*by-ay*bx;
}
function paint(ctx:CanvasRenderingContext2D, width:number, height:number, angle:number) {
  ctx.clearRect(0,0,width,height);
  const rendered=faces.map(face=>{
    const p=face.corners.map(x=>project(x,angle,width,height)) as [P,P,P,P];
    const z=p.reduce((n,x)=>n+x.z,0)/4;
    const facing=normalDepth(p[0],p[1],p[2]);
    return {p,z,facing,tint:face.tint};
  }).sort((a,b)=>a.z-b.z);
  ctx.lineJoin='round';
  for(const {p,facing,tint} of rendered) {
    const front=facing<0;
    const alpha=front ? .31 : .018;
    ctx.beginPath();
    ctx.moveTo(p[0].x,p[0].y);
    for(let k=1;k<4;k++)ctx.lineTo(p[k].x,p[k].y);
    ctx.closePath();
    ctx.fillStyle=front ? 'rgba(28,151,169,.12)' : 'rgba(22,104,144,.006)';
    ctx.fill();
    ctx.strokeStyle=tint===3 ? 'rgba(122,255,247,'+(alpha*.9)+')'
      : 'rgba(103,233,248,'+alpha+')';
    ctx.lineWidth=front ? .74 : .30;
    ctx.stroke();
  }
  // A handful of bright longitudinal outlines convey shape and musculature.
  ctx.globalCompositeOperation='screen';
  ctx.shadowColor='rgba(49,233,245,.65)';
  ctx.shadowBlur=5;
  const outline=contourLines;
  for(const path of outline){
    const coords=path.map(p=>project(p,angle,width,height));
    ctx.beginPath();ctx.moveTo(coords[0].x,coords[0].y);
    for(let j=1;j<coords.length;j++)ctx.lineTo(coords[j].x,coords[j].y);
    ctx.strokeStyle='rgba(106,237,247,.32)';ctx.lineWidth=.9;ctx.stroke();
  }
  ctx.shadowBlur=0;
  ctx.globalCompositeOperation='source-over';
}
export default function RunnerHologram3D({rotating,manualAngle}:{
  rotating:boolean;manualAngle:number;
}) {
  const canvas=useRef<HTMLCanvasElement|null>(null);
  const yaw=useRef(0);
  const previousManual=useRef(manualAngle);
  useEffect(()=>{
    const element=canvas.current;
    if(!element)return;
    const ctx=element.getContext('2d',{alpha:true});
    if(!ctx)return;
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    let frame=0,previous=0,lastPaint=0,active=true;
    const draw=(now:number)=>{
      if(!active)return;
      if(!previous)previous=now;
      const step=Math.min(60,now-previous);
      previous=now;
      if(rotating && !reduced)yaw.current+=step*.00047;
      else if(previousManual.current!==manualAngle){
        yaw.current+=(manualAngle-previousManual.current)*Math.PI/180;
      }
      previousManual.current=manualAngle;
      if(!lastPaint || now-lastPaint>36 || !rotating || reduced){
        const bounds=element.getBoundingClientRect();
        const dpr=Math.min(window.devicePixelRatio || 1,2);
        const w=Math.max(1,Math.round(bounds.width*dpr));
        const h=Math.max(1,Math.round(bounds.height*dpr));
        if(element.width!==w||element.height!==h){element.width=w;element.height=h;}
        ctx.setTransform(1,0,0,1,0,0);
        paint(ctx,w,h,yaw.current);
        lastPaint=now;
      }
      if(rotating && !reduced)frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return ()=>{active=false;cancelAnimationFrame(frame);};
  },[rotating,manualAngle]);
  return <canvas ref={canvas} width={190} height={370}
    className="rp-hologram-canvas" role="img"
    aria-label="Dreidimensionaler cyanfarbener Läufer, der um seine eigene Körperachse gedreht wird" />;
}
