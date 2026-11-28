import test from 'node:test';
import assert from 'node:assert/strict';
import {playArcadeFinishSfx, scheduleArcadeStartSfx} from '../src/lib/arcadeRaceAudio.ts';

test('finish hardware failures do not escape and partially started sounds are stopped',()=>{
 const original=globalThis.window;
 let ctx;
 class FakeAudio {
  state='running';currentTime=0;destination={};sampleRate=100;
  nodes=[];failCreateAt=0;failStopAt=0;noiseFails=false;noiseStops=[];
  constructor(){ctx=this;}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){return this;}};}
  createOscillator(){
   const index=this.nodes.length+1;
   if(index===this.failCreateAt)throw Error('oscillator unavailable');
   const node={frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},starts:0,stops:[],
    connect(gain){return gain;},start(){this.starts++;},stop(at){this.stops.push(at);if(index===ctx.failStopAt&&at!==undefined)throw Error('schedule failed');}};
   this.nodes.push(node);return node;
  }
  createBuffer(){return {getChannelData(){return new Float32Array(180);}};}
  createBufferSource(){return {connect(filter){return filter;},start(){},stop(at){ctx.noiseStops.push(at);if(ctx.noiseFails&&at!==undefined)throw Error('noise stop failed');}};}
  createBiquadFilter(){return {frequency:{setValueAtTime(){},linearRampToValueAtTime(){}},Q:{},connect(gain){return gain;}};}
 }
 try{
  globalThis.window={AudioContext:FakeAudio};
  // Initialize the fake context without scheduling any sounds.
  scheduleArcadeStartSfx(Date.now()-10000);
  ctx.failCreateAt=1;
  assert.doesNotThrow(()=>playArcadeFinishSfx());
  assert.equal(ctx.nodes.length,0);
  ctx.failCreateAt=2;
  assert.doesNotThrow(()=>playArcadeFinishSfx());
  assert.equal(ctx.nodes[0].stops.length,2);
  ctx.nodes=[];ctx.failCreateAt=0;ctx.failStopAt=1;
  assert.doesNotThrow(()=>playArcadeFinishSfx());
  assert.equal(ctx.nodes[0].starts,1);
  assert.equal(ctx.nodes[0].stops.at(-1),undefined);
  ctx.nodes=[];ctx.failStopAt=0;ctx.noiseFails=true;
  assert.doesNotThrow(()=>playArcadeFinishSfx());
  assert.equal(ctx.nodes.length,2);
  assert.equal(ctx.noiseStops.length,2);
  assert.equal(ctx.noiseStops.at(-1),undefined);
  ctx.nodes=[];ctx.noiseFails=false;ctx.noiseStops=[];
  assert.doesNotThrow(()=>playArcadeFinishSfx());
  assert.equal(ctx.nodes.length,2);
  assert.equal(ctx.noiseStops.length,1);
  ctx.nodes=[];ctx.failStopAt=1;
  assert.equal(scheduleArcadeStartSfx(Date.now()+3000),null);
  assert.equal(ctx.nodes[0].stops.at(-1),undefined);
 }finally{
  if(original===undefined)delete globalThis.window;else globalThis.window=original;
 }
});
