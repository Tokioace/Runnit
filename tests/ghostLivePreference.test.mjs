import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');

test('ghost sound preference is applied synchronously and old GPS callbacks read the latest value',()=>{
 assert.match(source,/const soundEnabledRef = useRef\(true\);/);
 assert.match(source,/const toggleSound = \(\) => \{\s*const enabled = !soundEnabledRef.current;\s*soundEnabledRef.current = enabled;\s*setRaceAudioMuted\(!enabled\);\s*setSoundEnabled\(enabled\);/);
 assert.match(source,/onClick=\{toggleSound\}/);
 const start=source.indexOf('const stopRun ='),end=source.indexOf('const onGps =',start);
 assert.ok(start>=0&&end>start);
 const stop=source.slice(start,end);
 assert.match(stop,/if \(soundEnabledRef.current\) playArcadeFinishSfx\(\);/);
 assert.match(stop,/\}, \[setCurrentPhase, stopGps, saveSummary\]\);/);
 assert.doesNotMatch(stop,/if \(soundEnabled\)/);
});
test('private save choice is updated by the checkbox before a queued completion',()=>{
 assert.match(source,/const changeSavePreference = \(enabled: boolean\) => \{[^\n]*\n\s*\/\/[^\n]*\n\s*saveEnabledRef.current = enabled;\s*setSaveToAccount\(enabled\);/);
 assert.match(source,/checked=\{saveToAccount\} onChange=\{event => changeSavePreference\(event.target.checked\)\}/);
 assert.doesNotMatch(source,/useEffect\(\(\) => \{ saveEnabledRef.current = saveToAccount;/);
 const a=source.indexOf('const saveSummary ='),b=source.indexOf('const stopRun =',a);
 assert.ok(a>=0&&b>a);
 assert.match(source.slice(a,b),/if \(!saveEnabledRef.current \|\| !user\?\.id \|\| savedRef.current \|\| !lifetime.current.isActive\(\)\) return;/);
});
