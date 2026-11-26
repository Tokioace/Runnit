import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDuelStartLatch} from '../src/lib/duelStartLatch.ts';

test('old lobby rows cannot reset a server-confirmed start',()=>{
 const latch=createDuelStartLatch();
 assert.equal(latch.accept('a',null),true);
 assert.equal(latch.accept('a','2026-11-26T16:00:00Z'),true);
 assert.equal(latch.accept('a',null),false);
 assert.equal(latch.accept('a','2026-11-26T16:00:01Z'),false);
 assert.equal(latch.accept('a','2026-11-26T17:00:00+01:00'),true);
});
test('invalid starts do not poison a duel and different duels are independent',()=>{
 const latch=createDuelStartLatch();
 assert.equal(latch.accept('a','invalid'),false);
 assert.equal(latch.accept('a',null),true);
 assert.equal(latch.accept('a','2026-11-26T16:00:00Z'),true);
 assert.equal(latch.accept('b',null),true);
 assert.equal(latch.accept('b','2026-11-26T16:01:00Z'),true);
 assert.equal(latch.accept('a',null),false);
});
test('shared matched transition rejects stale snapshots before changing local race state',()=>{
 const source=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('const applyMatchedDuel ='),source.indexOf('// Display only profile nicknames'));
 assert.match(block,/if \(!duelStartLatch.current.accept\(row.id, startAt\)\) return;/);
 assert.ok(block.indexOf('duelStartLatch.current.accept')<block.indexOf('activeDuelIdRef.current = row.id'));
 assert.match(block,/const key = row.id \+ ':' \+ serverStart;/);
});
