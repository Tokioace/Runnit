import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
test('Ghost Run records a stable terminal timestamp before displaying the summary',()=>{
 const a=source.indexOf('const stopRun ='),b=source.indexOf('const stopAtDurationLimit =',a);
 assert.ok(a>=0&&b>a);
 const stop=source.slice(a,b);
 assert.match(stop,/terminalReportRef.current = \{ summary: summaryRow, recordedAt: new Date\(\).toISOString\(\) \};\s*setSummary\(summaryRow\);/);
 const c=source.indexOf('const exportJson ='),d=source.indexOf('const reset =',c);
 assert.ok(c>=0&&d>c);
 const exportBlock=source.slice(c,d);
 assert.match(exportBlock,/const terminal = terminalReportRef.current;\s*if \(!terminal \|\| terminal.summary !== summary\) return;/);
 assert.match(exportBlock,/recorded_at: terminal.recordedAt,/);
 assert.doesNotMatch(exportBlock,/new Date\(/);
 assert.match(exportBlock,/phaseRef.current !== 'finished' && phaseRef.current !== 'stopped'/);
});
test('terminal export cannot use a previous run snapshot after a new start or screen retirement',()=>{
 const a=source.indexOf('const beginRun ='),b=source.indexOf('useEffect(() =>',a);
 assert.ok(a>=0&&b>a);
 assert.match(source.slice(a,b),/activeRef.current = first;\s*terminalReportRef.current = null;/);
 const c=source.indexOf('useLayoutEffect(() => {\n    lifetime.current.open();'),d=source.indexOf('}, [stopGps]);',c);
 assert.ok(c>=0&&d>c);
 assert.match(source.slice(c,d),/activeRef.current = null;\s*terminalReportRef.current = null;/);
});
test('explicit reset drops discarded measurement data immediately without deleting stored runs',()=>{
 const a=source.indexOf('const reset ='),b=source.indexOf('const elapsedMs =',a);
 assert.ok(a>=0&&b>a);
 const reset=source.slice(a,b);
 assert.match(reset,/if \(savePendingRef.current \|\| phaseRef.current === 'running' \|\| phaseRef.current === 'countdown'\) return;/);
 assert.match(reset,/activeRef.current = null;\s*terminalReportRef.current = null;\s*startedRef.current = null;/);
 assert.match(reset,/gpsTraceRef.current = \[\];\s*motionTraceRef.current = \[\];\s*gpsTraceOmittedRef.current = 0;\s*firstMotionOmittedMsRef.current = null;/);
 assert.match(reset,/stepRef.current.reset\(\);\s*lastMotionAt.current = null;\s*gapCountRef.current = 0;/);
 assert.doesNotMatch(reset,/supabase|localStorage|setSavedRuns/);
});
