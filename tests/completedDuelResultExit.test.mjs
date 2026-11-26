import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/components/race/DuelFinishScreen.tsx',import.meta.url),'utf8');

test('confirmed completion is published before the potentially failing result RPC',()=>{
 const marker=source.indexOf("if (duel.status === 'completed') {");
 const rpc=source.indexOf('const resultsResponse = await getDuelResults');
 assert.ok(marker>=0&&marker<rpc);
 assert.match(source.slice(marker,rpc),/setHostId\(duel.host_user_id\);\s*setChallengerId\(duel.challenger_user_id\);\s*setStatus\('completed'\);/);
});
test('incomplete terminal results permit local exit but never abort or submit again',()=>{
 assert.match(source,/const terminalWithoutResult = status === 'abandoned' \|\| status === 'unavailable' \|\|\s*\(status === 'completed' && !completed\);/);
 assert.match(source,/if \(retryBusy \|\| completed \|\| terminalWithoutResult\) return;/);
 assert.match(source,/if \(abortBusy \|\| completed \|\| terminalWithoutResult\) return;/);
 assert.match(source,/submissionError && !completed && !terminalWithoutResult/);
 assert.match(source,/\) : terminalWithoutResult \? \(\s*<button[^>]*onClick=\{onClose\}/);
 assert.match(source,/status === 'completed' && !completed && \(\s*<p[^>]*role="status">/);
});
