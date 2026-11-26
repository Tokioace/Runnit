import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
const nearby=map.slice(map.indexOf('// Guests have an empty real challenge feed'),map.indexOf('// A regional view'));
test('optional nickname lookup cannot discard confirmed open races',()=>{
  assert.match(nearby,/let hostUsers: Array<\{ id: string; username: string \}> = \[\];/);
  assert.match(nearby,/if \(hostIds.length > 0\) \{\s*try \{[\s\S]*?if \(!namesError && names\) hostUsers = names;\s*\} catch \{[\s\S]*?\}\s*\}/);
  assert.match(nearby,/hostUsername: hostById.get\(d.host_user_id\)\?\.username \|\| 'host'/);
  assert.ok(nearby.indexOf('mapped = data')>nearby.indexOf('A rejected nickname request'));
});
test('nearby transport rejection preserves the last feed and retired accounts cannot publish results',()=>{
  assert.match(nearby,/if \(!isActive \|\| error\) return;[^\n]*\n\s*if \(finishAccountRef.current !== authUser.id\) return;/);
  assert.match(nearby,/if \(!isActive \|\| finishAccountRef.current !== authUser.id\) return;/);
  assert.match(nearby,/if \(isActive && finishAccountRef.current === authUser.id\) setOpenRuns/);
  assert.match(nearby,/\} catch \{\s*\/\/ Preserve the last confirmed event feed on transport rejection.\s*\} finally \{/);
});
