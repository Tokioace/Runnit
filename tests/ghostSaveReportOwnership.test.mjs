import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownsGhostSaveReport} from '../src/lib/ghostSaveResponse.ts';
const source=readFileSync(new URL('../src/screens/GhostRunScreen.tsx',import.meta.url),'utf8');
test('only the exact terminal report is eligible for a private save or retry',()=>{
 const original={elapsed_ms:5000,steps_count:20};
 const replacement={...original};
 for(const phase of ['finished','stopped']){
  assert.equal(ownsGhostSaveReport({summary:original},original,phase),true);
  assert.equal(ownsGhostSaveReport({summary:replacement},original,phase),false);
  assert.equal(ownsGhostSaveReport(null,original,phase),false);
 }
 for(const phase of ['idle','acquiring','ready','countdown','running','error'])
  assert.equal(ownsGhostSaveReport({summary:original},original,phase),false);
});
test('old callbacks are rejected before allocating an ID, claiming a save or accessing account storage',()=>{
 const a=source.indexOf('const saveSummary ='),b=source.indexOf('const stopRun =',a);
 assert.ok(a>=0&&b>a);
 const save=source.slice(a,b);
 const guard=save.indexOf('if (!ownsGhostSaveReport(terminalReportRef.current, item, phaseRef.current)) return;');
 assert.ok(guard>=0);
 for(const marker of ['beginAccountMutation()','crypto.randomUUID()','savedRef.current = true','savePendingRef.current = true',".insert(payload)"])
  assert.ok(save.indexOf(marker)>guard,marker);
 const stop=source.slice(b,source.indexOf('const stopAtDurationLimit =',b));
 assert.ok(stop.indexOf('setCurrentPhase(reason)')<stop.indexOf('terminalReportRef.current = { summary: summaryRow'));
 assert.ok(stop.indexOf('terminalReportRef.current = { summary: summaryRow')<stop.indexOf('void saveSummary(summaryRow)'));
});
test('new run and reset retire report identity and save ID without deleting account data',()=>{
 const a=source.indexOf('const reset ='),b=source.indexOf('const elapsedMs =',a);
 const reset=source.slice(a,b);
 assert.match(reset,/if \(savePendingRef.current \|\| phaseRef.current === 'running' \|\| phaseRef.current === 'countdown'\) return;/);
 assert.match(reset,/terminalReportRef.current = null;\s*startedRef.current = null;\s*saveIdRef.current = null;\s*savedRef.current = false;/);
 assert.doesNotMatch(reset,/\.delete\(|\.insert\(|\.update\(/);
 const c=source.indexOf('const beginRun ='),d=source.indexOf('useEffect(() =>',c);
 const begin=source.slice(c,d);
 assert.match(begin,/terminalReportRef.current = null;/);
 assert.match(begin,/savedRef.current = false;\s*saveIdRef.current = null;/);
});
