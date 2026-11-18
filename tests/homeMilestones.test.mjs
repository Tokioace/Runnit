import test from 'node:test';
import assert from 'node:assert/strict';
import { nextWinMilestone } from '../src/lib/homeMilestones.ts';

test('Milestones advance strictly from completed real wins, never fake a rank', () => {
 assert.deepEqual(nextWinMilestone(0),{start:0,target:5,percent:0});
 assert.deepEqual(nextWinMilestone(1),{start:0,target:5,percent:20});
 assert.deepEqual(nextWinMilestone(5),{start:5,target:10,percent:0});
 assert.deepEqual(nextWinMilestone(8),{start:5,target:10,percent:60});
 assert.deepEqual(nextWinMilestone(100),{start:100,target:200,percent:0});
 assert.deepEqual(nextWinMilestone(205),{start:200,target:300,percent:5});
 assert.equal(nextWinMilestone(-1).target,5);
});
