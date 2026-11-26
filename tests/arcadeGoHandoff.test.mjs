import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleArcadeStartSfx} from '../src/lib/arcadeRaceAudio.ts';
test('normal GO handoff preserves only the short scheduled GO tones, while abort and clock drift stop all',()=>{
 const originalWindow=globalThis.window, originalNow=Date.now;
 let now=10000,ctx;
 class FakeAudio {
  state='running';currentTime=0;destination={};nodes=[];
  constructor(){ctx=this;}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return this;}};}
  createOscillator(){
   const node={frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},
    stops:[],connect(gain){return gain;},start(at){this.at=at;},stop(at){this.stops.push(at);}};
   this.nodes.push(node);return node;
  }
 }
 try{
  globalThis.window={AudioContext:FakeAudio};Date.now=()=>now;
  const stop=scheduleArcadeStartSfx(13000);
  assert.equal(ctx.nodes.length,5);
  now=13000;ctx.currentTime=3;
  stop(true);
  assert.deepEqual(ctx.nodes.map(n=>n.stops.length),[2,2,2,1,1]);
  ctx.nodes=[];now=20000;ctx.currentTime=10;
  const abort=scheduleArcadeStartSfx(23000);now=21000;ctx.currentTime=11;abort();
  assert.deepEqual(ctx.nodes.map(n=>n.stops.length),[2,2,2,2,2]);
  ctx.nodes=[];now=30000;ctx.currentTime=20;
  const delayed=scheduleArcadeStartSfx(33000);now=33000;ctx.currentTime=20.5;delayed(true);
  assert.deepEqual(ctx.nodes.map(n=>n.stops.length),[2,2,2,2,2]);
  ctx.nodes=[];now=40000;ctx.currentTime=30;
  const suspended=scheduleArcadeStartSfx(43000);now=43000;ctx.currentTime=33;ctx.state='suspended';suspended(true);
  assert.deepEqual(ctx.nodes.map(n=>n.stops.length),[2,2,2,2,2]);
 }finally{
  Date.now=originalNow;
  if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
 }
});
