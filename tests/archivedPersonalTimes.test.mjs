import test from 'node:test';
import assert from 'node:assert/strict';
import { archivedPersonalTimes, calculateActivityTotals } from '../src/lib/runnerHistory.ts';
test('archive retains own time without rival identity or ranked outcome',()=>{
 const rows=archivedPersonalTimes([{id:'new-id',occurred_at:'2026-11-25T12:00:00Z',target_distance_m:50,time_ms:6500,steps_count:22,distance_m:50}]);
 assert.equal(rows[0].timeMs,6500);assert.equal(rows[0].archivedPersonal,true);
 assert.equal(rows[0].completed,false);assert.equal(rows[0].opponentTimeMs,null);
 assert.equal(rows[0].opponentUserId,undefined);assert.equal(rows[0].opponentName,undefined);
 const totals=calculateActivityTotals(rows,[],Date.parse('2026-11-23T00:00:00Z'));
 assert.equal(totals.completedDuels,0);assert.equal(totals.best50Ms,null);assert.equal(totals.wins,0);
});
test('invalid archived rows do not become personal history',()=>{
 assert.deepEqual(archivedPersonalTimes([{id:'x',occurred_at:'bad',time_ms:1},{id:'y',occurred_at:'2026-11-25T12:00:00Z',time_ms:-1}]),[]);
});
