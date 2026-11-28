import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const map=readFileSync(new URL('../src/screens/MapScreen.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
test('the account-keyed map reserves its saved duel before realtime and recovery run',()=>{
 assert.match(app,/<MapScreen key=\{auth.user\?\.id \?\? 'guest'\} auth=\{auth\}/);
 assert.match(map,/const \[initialActiveDuelId\] = useState\(\(\) => authUser \? readActiveDuelId\(authUser.id\) : null\);\s*const activeDuelIdRef = useRef<string \| null>\(initialActiveDuelId\);/);
 assert.ok(map.indexOf('const [initialActiveDuelId]')<map.indexOf('const queue = createDuelRecoveryQueue'));
 assert.ok(map.indexOf('const [initialActiveDuelId]')<map.indexOf(".channel('duels-realtime')"));
});
test('direct recovery of the reserved duel includes readiness and handles all confirmed race statuses',()=>{
 const recover=map.slice(map.indexOf('const queue = createDuelRecoveryQueue'),map.indexOf('const whenVisible ='));
 assert.match(recover,/const \{ data: latest, error: statusError \} = await supabase.from\('duels'\)\s*\.select\('id, status, host_user_id, challenger_user_id, start_at, target_distance_m, host_ready, challenger_ready'\)\s*\.eq\('id', activeId\).maybeSingle\(\)/);
 assert.match(recover,/if \(!current\(\) \|\| statusError \|\| activeDuelIdRef.current !== activeId\) return;/);
 assert.match(recover,/if \(latest && \(latest.host_user_id !== authUser.id && latest.challenger_user_id !== authUser.id\)\) return;/);
 assert.match(recover,/else if \(latest\?\.status === 'completed'\) \{\s*showCompletedDuel\(latest\);\s*\} else if \(latest\?\.status === 'matched'\) \{\s*applyMatchedDuel\(latest\);/);
});
