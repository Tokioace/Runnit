import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isDeletionConfirmation, parseDeletionRequest } from '../src/lib/accountDeletionRequest.ts';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
test('destructive request requires explicit confirmation',()=>{
 assert.equal(isDeletionConfirmation('LÖSCHEN'),true);
 for (const value of ['', 'löschen', 'JA', 'DELETE']) assert.equal(isDeletionConfirmation(value),false);
});
test('only server acknowledgement with a valid timestamp is recognized',()=>{
 assert.deepEqual(parseDeletionRequest({requested_at:'2026-11-25T12:00:00Z',email:'private'}),{requested_at:'2026-11-25T12:00:00Z'});
 assert.equal(parseDeletionRequest(null),null);assert.equal(parseDeletionRequest({requested_at:'invalid'}),null);
});
test('release gate hides unfinished feature; no direct admin deletion from browser',()=>{
 const panel=read('src/components/profile/AccountDetailsPanel.tsx');
 const db=read('src/db/accountDeletionRequest.ts');
 assert.match(panel,/VITE_ACCOUNT_DELETION_REQUESTS_ENABLED === 'true'/);
 assert.match(db,/data.user\?\.id !== userId/);
 assert.match(db,/error.code !== '23505'/);
 assert.match(db,/await readAccountDeletionRequest\(userId\)/);
 assert.doesNotMatch(db,/service_role|auth\.admin|deleteUser/);
});
