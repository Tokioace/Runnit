import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setRaceAudioMuted,unlockRaceAudio,scheduleArcadeStartSfx} from '../src/lib/arcadeRaceAudio.ts';

test('a new mode can enable audio after the previous mode muted the shared context',async()=>{
 const original=globalThis.window;
 let created=0;
 class FakeAudio {
  state='suspended';currentTime=0;
  constructor(){created++;}
  async resume(){this.state='running';}
 }
 try {
  globalThis.window={AudioContext:FakeAudio};
  setRaceAudioMuted(true);
  assert.equal(await unlockRaceAudio(),false);
  assert.equal(created,0);
  setRaceAudioMuted(false);
  assert.equal(await unlockRaceAudio(),true);
  assert.equal(created,1);
  setRaceAudioMuted(true);
  assert.equal(scheduleArcadeStartSfx(Date.now()+3000),null);
  setRaceAudioMuted(false);
  assert.equal(await unlockRaceAudio(),true);
  assert.equal(created,1);
 }finally{
  setRaceAudioMuted(false);
  if(original===undefined)delete globalThis.window;else globalThis.window=original;
 }
});
test('Ghost Run applies its own sound preference before countdown effects and respects mute at start and finish',()=>{
 const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
 assert.match(source,/useLayoutEffect\(\(\) => \{ setRaceAudioMuted\(!soundEnabled\); \}, \[soundEnabled\]\)/);
 assert.match(source,/if \(soundEnabled\) unlockRaceAudio\(\)/);
 assert.match(source,/if \(soundEnabled\) playArcadeFinishSfx\(\)/);
 assert.match(source,/soundEnabled=\{soundEnabled\} onDone=\{beginRun\}/);
 const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 assert.match(map,/setRaceAudioMuted\(!raceSoundEnabled\)/);
});
