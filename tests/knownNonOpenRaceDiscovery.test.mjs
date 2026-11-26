import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');

test('confirmed non-open events cannot be restored by delayed nearby, regional or hosted reads',()=>{
  assert.match(map,/reconcileOpenRaces\(previous, mapped, authUser.id\)\s*\.filter\(run => !knownNonOpenRunIdsRef.current.has\(run.id\)\)/);
  assert.match(map,/setRegionalRuns\(\(data \?\? \[\]\).flatMap\(row => \{\s*if \(knownNonOpenRunIdsRef.current.has\(row.id\)\) return \[\];/);
  assert.match(map,/const open = runs.filter\(run => !knownNonOpenRunIdsRef.current.has\(run.id\)\);\s*setHostedOpenDuels\(open\)/);
  assert.match(map,/setHostedOpenDuels\(runs.filter\(item => !knownNonOpenRunIdsRef.current.has\(item.id\)\)\)/);
});

test('non-open realtime transitions remove regional markers and suppress delayed open events',()=>{
  assert.match(map,/if \(payload.eventType === 'DELETE' \|\| row.status !== 'open'\) \{\s*knownNonOpenRunIdsRef.current.add\(row.id\);\s*setRegionalRuns\(previous => previous.filter\(run => run.id !== row.id\)\);\s*\} else if \(knownNonOpenRunIdsRef.current.has\(row.id\)\) \{\s*return;/);
});

test('confirmed local match and cancellation retire their markers without waiting for realtime',()=>{
  assert.match(map,/rememberActiveDuelId\(authUser.id, row.id\);\s*knownNonOpenRunIdsRef.current.add\(row.id\);\s*setRegionalRuns/);
  assert.match(map,/if \(result.status === 'cancelled'\) \{\s*knownNonOpenRunIdsRef.current.add\(run.id\);\s*setRegionalRuns/);
  assert.match(map,/completedDuelIdsRef.current.add\(row.id\);\s*knownNonOpenRunIdsRef.current.add\(row.id\)/);
  assert.match(map,/endedDuelIdsRef.current.add\(duelId\);\s*knownNonOpenRunIdsRef.current.add\(duelId\)/);
});

test('late host creation cannot republish an already matched or expired event',()=>{
  const host=map.slice(map.indexOf('const handleHostRun ='),map.indexOf('const handleCancelHostedRun ='));
  const response=host.indexOf('if (!data?.id');
  const publish=host.indexOf('const created: OpenRun');
  const guard=host.slice(response,publish);
  assert.ok(response>=0 && publish>response);
  assert.match(guard,/if \(knownNonOpenRunIdsRef.current.has\(data.id\)\) \{\s*setDiscoveryRefreshTick\(tick => tick \+ 1\);\s*return;\s*\}/);
  assert.match(guard,/if \(!isOpenEventAvailable\(data.expires_at\)\) \{\s*setDiscoveryRefreshTick\(tick => tick \+ 1\);\s*setRaceNotice\([^\n]+\);\s*return;\s*\}/);
  assert.ok(host.indexOf('setOpenRuns(previous => [created')>publish);
  assert.ok(host.indexOf('setHostedOpenDuels(previous => [')>publish);
});
