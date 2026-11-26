import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
test('Ghost Run cannot reset during a pending save, including before React renders',()=>{
 const reset=source.slice(source.indexOf('const reset ='),source.indexOf('const elapsedMs ='));
 assert.match(reset,/if \(savePendingRef.current \|\| phaseRef.current === 'running' \|\| phaseRef.current === 'countdown'\) return;/);
 assert.match(source,/onClick=\{reset\} disabled=\{saveStatus === 'saving'\}/);
 const save=source.slice(source.indexOf('const saveSummary'),source.indexOf('const stopRun'));
 assert.match(save,/savedRef.current = true;[^\n]*\n\s*savePendingRef.current = true;/);
 assert.match(save,/if \(!measurementAccountCurrent\(isLive, assertAccount\)\) return;\s*savePendingRef.current = false;/);
});
test('uncertain transport failures do not allow duplicate blind inserts',()=>{
 const save=source.slice(source.indexOf('const saveSummary'),source.indexOf('const stopRun'));
 assert.match(save,/uncertain = Boolean\(response.error\) && response.status === 0;/);
 assert.match(save,/catch \{\s*uncertain = true;/);
 const unknown=save.slice(save.indexOf('if (uncertain)'),save.indexOf('else if (error)'));
 assert.match(unknown,/setSaveStatus\('unknown'\)/);
 assert.doesNotMatch(unknown,/savedRef.current = false/);
 assert.match(save,/else if \(error\) \{\s*savedRef.current = false;/);
 assert.match(source,/saveStatus === 'error' && <button/);
});
