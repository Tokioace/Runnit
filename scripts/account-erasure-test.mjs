// Run only on a trusted operator machine against a disposable Supabase project.
import { createClient } from '@supabase/supabase-js';
import { processTestErasure, validateTestTarget } from './account-erasure-core.mjs';
import { createErasureSessionProbe } from './account-erasure-session-probe.mjs';
const [userId,mode,...extra] = process.argv.slice(2);
const url=process.env.RUNNIT_TEST_SUPABASE_URL;
const ref=process.env.RUNNIT_TEST_SUPABASE_REF;
try {
  if (extra.length || !['--dry-run','--execute-test'].includes(mode)) throw new Error('Specify synthetic UUID and --dry-run or --execute-test');
  validateTestTarget(url,ref,userId);
  const key=process.env.RUNNIT_TEST_SUPABASE_SERVICE_KEY;
  if (!key) throw new Error('Missing server-only test credential');
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const sessionProbe=createErasureSessionProbe(client,{url,ref,userId,
    controlDuelId:process.env.RUNNIT_TEST_ERASURE_CONTROL_DUEL_ID,
    publishableKey:process.env.RUNNIT_TEST_SUPABASE_PUBLISHABLE_KEY,
    accessToken:process.env.RUNNIT_TEST_ERASURE_ACCESS_TOKEN});
  const result=await processTestErasure(client,{url,ref,userId,execute:mode==='--execute-test',
    syntheticOnly:process.env.RUNNIT_NATIVE_TEST_DATA_CONFIRMED,
    expectedEmail:process.env.RUNNIT_TEST_ERASURE_EMAIL,
    confirmation:process.env.RUNNIT_TEST_ERASURE_CONFIRMATION,sessionProbe});
  // No email, tokens, user UUID or raw result rows in logs.
  console.log(JSON.stringify(result));
} catch {
  // SDK/transport exceptions are not guaranteed to be free of credentials or PII.
  // Never print an arbitrary exception or retry deletion on an ambiguous outcome.
  console.error('Synthetic erasure verification failed. Inspect the test project securely; do not retry deletion blindly.');
  process.exitCode=1;
}
