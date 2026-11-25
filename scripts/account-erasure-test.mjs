// Run only on a trusted operator machine against a disposable Supabase project.
import { createClient } from '@supabase/supabase-js';
import { processTestErasure, validateTestTarget } from './account-erasure-core.mjs';
const [userId,mode,...extra] = process.argv.slice(2);
const url=process.env.RUNNIT_TEST_SUPABASE_URL;
const ref=process.env.RUNNIT_TEST_SUPABASE_REF;
try {
  if (extra.length || !['--dry-run','--execute-test'].includes(mode)) throw new Error('Specify synthetic UUID and --dry-run or --execute-test');
  validateTestTarget(url,ref,userId);
  const key=process.env.RUNNIT_TEST_SUPABASE_SERVICE_KEY;
  if (!key) throw new Error('Missing server-only test credential');
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const result=await processTestErasure(client,{url,ref,userId,execute:mode==='--execute-test',
    confirmation:process.env.RUNNIT_TEST_ERASURE_CONFIRMATION});
  // No email, tokens, user UUID or raw result rows in logs.
  console.log(JSON.stringify(result));
} catch(error) {
  console.error(error instanceof Error ? error.message : 'Erasure operation failed');
  process.exitCode=1;
}
