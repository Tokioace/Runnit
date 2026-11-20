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
// Athletic neutral anatomical mannequin, with volume through all 360 degrees.
ellipsoid([0,1.48,0], [.248,.32,.23], 2, 11, 16);  // skull
ellipsoid([0,1.10,0], [.135,.15,.125], 1, 5, 10);  // neck
ellipsoid([0,.79,-.018], [.48,.36,.30], 1, 12, 16); // chest
ellipsoid([-.216,.83,.20],[.224,.21,.13], 3, 5, 9); // left pectoral
ellipsoid([ .216,.83,.20],[.224,.21,.13], 3, 5, 9); // right pectoral
ellipsoid([0,.35,-.01], [.345,.38,.24], 0, 10, 14); // abdomen
for(const x of [-.116,.116])for(const y of [.47,.28,.09])
  ellipsoid([x,y,.214],[.109,.078,.034],3,4,8); // abdominal bands
ellipsoid([0,-.08,-.015], [.36,.255,.265], 1, 8, 14); // pelvis
for(const sign of [-1,1] as const) {
  ellipsoid([sign*.48,.92,-.018],[.205,.235,.214],1,7,12); // deltoids
  limb([sign*.53,.86,.01],[sign*.70,.35,.015],.175,.155,2,7,12); // biceps
  ellipsoid([sign*.71,.34,.013],[.112,.11,.12],0,5,10);
  limb([sign*.70,.34,.015],[sign*.80,-.22,.105],.123,.121,1,6,12);
  ellipsoid([sign*.80,-.29,.125],[.112,.18,.09],2,6,10); // hand
  ellipsoid([sign*.21,-.26,-.02],[.245,.275,.245],1,9,14); // upper thigh
  limb([sign*.23,-.31,-.016],[sign*.29,-1.01,.005],.215,.208,2,9,14);
  ellipsoid([sign*.29,-1.01,.006],[.142,.16,.145],1,7,10);
  limb([sign*.29,-1.04,.012],[sign*.32,-1.60,-.028],.147,.153,1,9,12);
  ellipsoid([sign*.32,-1.58,.010],[.103,.12,.11],0,5,10);
  ellipsoid([sign*.32,-1.70,.16],[.157,.098,.31],2,7,12); // shoe
}
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
    const alpha=front?.28:.055;
    ctx.beginPath();
    ctx.moveTo(p[0].x,p[0].y);
    for(let k=1;k<4;k++)ctx.lineTo(p[k].x,p[k].y);
    ctx.closePath();
    ctx.fillStyle=front ? 'rgba(25,143,179,.085)' : 'rgba(28,136,156,.02)';
    ctx.fill();
    ctx.strokeStyle=tint===3 ? 'rgba(122,255,247,'+(alpha*.9)+')'
      : 'rgba(103,233,248,'+alpha+')';
    ctx.lineWidth=front?.85:.45;
    ctx.stroke();
  }
  // A handful of bright longitudinal outlines convey shape and musculature.
  ctx.globalCompositeOperation='screen';
  ctx.shadowColor='rgba(49,233,245,.65)';
  ctx.shadowBlur=5;
  const outline=[
    [[0,1.82,0],[0,1.70,.17]],
    [[-.5,.97,0],[-.72,.34,.03],[-.81,-.3,.11]],
    [[.5,.97,0],[.72,.34,.03],[.81,-.3,.11]],
    [[-.34,.40,.18],[-.32,-.14,.20],[-.31,-.98,.13],[-.31,-1.68,.16]],
    [[.34,.40,.18],[.32,-.14,.20],[.31,-.98,.13],[.31,-1.68,.16]],
  ] as V[][];
  for(const path of outline){
    const coords=path.map(p=>project(p,angle,width,height));
    ctx.beginPath();ctx.moveTo(coords[0].x,coords[0].y);
    for(let j=1;j<coords.length;j++)ctx.lineTo(coords[j].x,coords[j].y);
    ctx.strokeStyle='rgba(106,237,247,.25)';ctx.lineWidth=1.2;ctx.stroke();
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
