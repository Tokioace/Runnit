// Server/operator-only module. No browser import, credentials, or real network in tests.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REF = /^[a-z0-9]{20}$/;
const LIVE_REF = 'fcbffqcmvgdojsdfwgyt';
const TABLES = ['users','ghost_runs','ghost_run_sessions','duel_results',
  'runner_stats_preferences','account_deletion_requests','archived_personal_duel_times'];

export function validateTestTarget(url, ref, userId) {
  if (!REF.test(ref || '') || ref === LIVE_REF || !UUID.test(userId || ''))
    throw new Error('Explicit non-production project and synthetic user required');
  if (url !== 'https://' + ref + '.supabase.co') throw new Error('Project URL mismatch');
}
function assertResult(result, message) {
  if (!result || result.error) throw new Error(message);
  return result.data;
}
async function counts(client, userId) {
  const list = await Promise.all(TABLES.map(async table => {
    const result = await client.from(table).select(table === 'users' ? 'id' : 'user_id', {count:'exact',head:true})
      .eq(table === 'users' ? 'id' : 'user_id', userId);
    if (result.error || !Number.isSafeInteger(result.count) || result.count < 0)
      throw new Error('Cannot verify ' + table);
    return [table,result.count];
  }));
  const duels = await client.from('duels').select('id',{count:'exact',head:true})
    .or('host_user_id.eq.'+userId+',challenger_user_id.eq.'+userId);
  if (duels.error || !Number.isSafeInteger(duels.count) || duels.count < 0) throw new Error('Cannot verify duels');
  return Object.fromEntries([...list,['duels',duels.count]]);
}
export async function processTestErasure(client, {url,ref,userId,syntheticOnly,expectedEmail,execute=false,confirmation='',sessionProbe}) {
  validateTestTarget(url,ref,userId);
  if (syntheticOnly !== 'synthetic-only' || typeof expectedEmail !== 'string' ||
      !/^runnit-test-[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(expectedEmail))
    throw new Error('Explicit synthetic-only environment and test email required');
  if (execute && confirmation !== 'DELETE SYNTHETIC ' + userId) throw new Error('Explicit deletion confirmation required');
  const auth = assertResult(await client.auth.admin.getUserById(userId),'Cannot verify Auth identity');
  if (!auth?.user || auth.user.id !== userId || !auth.user.email_confirmed_at ||
      auth.user.is_anonymous === true || typeof auth.user.email !== 'string' ||
      auth.user.email.toLowerCase() !== expectedEmail.toLowerCase())
    throw new Error('Confirmed synthetic identity required');
  // Never claim provider revocation for an OAuth account.
  const identities = auth.user.identities;
  if (!Array.isArray(identities) || !identities.length || identities.some(i=>i.provider !== 'email'))
    throw new Error('External provider revocation requires separate review');
  const request = assertResult(await client.from('account_deletion_requests').select('user_id,requested_at')
    .eq('user_id',userId).maybeSingle(),'Cannot verify request');
  if (!request || request.user_id !== userId || !Number.isFinite(Date.parse(request.requested_at)))
    throw new Error('No confirmed deletion request');
  const before = await counts(client,userId);
  if (before.users !== 1 || before.account_deletion_requests !== 1) throw new Error('Unexpected account state');
  const active = await client.from('duels').select('id',{count:'exact',head:true})
    .or('host_user_id.eq.'+userId+',challenger_user_id.eq.'+userId).eq('status','matched');
  if (active.error || !Number.isSafeInteger(active.count) || active.count !== 0)
    throw new Error('Active match or unknown match state');
  // The candidate database guard must report the installed FK, trigger,
  // request and archive schema before even a synthetic deletion is allowed.
  const gate = assertResult(await client.rpc('runnit_test_erasure_gate'),'Erasure schema not verified');
  if (gate !== true) throw new Error('Erasure schema not ready');
  if (execute && (!sessionProbe || typeof sessionProbe.before!=='function' || typeof sessionProbe.after!=='function')) throw new Error('Stale-session probe required before deletion');
  if (sessionProbe) await sessionProbe.before();
  if (!execute) return {status:'dry-run',counts:before};
  const deleted = await client.auth.admin.deleteUser(userId,false);
  if (deleted.error) throw new Error('Auth deletion not confirmed; inspect request before retrying');
  const afterAuth = await client.auth.admin.getUserById(userId);
  if (!afterAuth.error || afterAuth.error.status !== 404) throw new Error('Auth absence not verified');
  const after = await counts(client,userId);
  if (Object.values(after).some(n=>n!==0)) throw new Error('Residual data detected; do not confirm completion');
  await sessionProbe.after();
  return {status:'verified-test-erasure',counts:after,notificationRequired:true,controlDuelSessionDenied:true};
}
