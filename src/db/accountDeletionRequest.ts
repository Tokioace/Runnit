import { supabase } from '../lib/supabaseClient';
import { isDeletionConfirmation, parseDeletionRequest } from '../lib/accountDeletionRequest';

async function requireAccount(userId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || data.user?.id !== userId) throw new Error('Account mismatch');
}
export async function readAccountDeletionRequest(userId: string) {
  await requireAccount(userId);
  const { data, error } = await supabase.from('account_deletion_requests')
    .select('requested_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data === null) return null;
  const request = parseDeletionRequest(data);
  if (!request) throw new Error('Invalid request response');
  return request;
}
export async function requestAccountDeletion(userId: string, confirmation: string) {
  if (!isDeletionConfirmation(confirmation)) throw new Error('Confirmation required');
  await requireAccount(userId);
  const { error } = await supabase.from('account_deletion_requests').insert({ user_id: userId });
  if (error && error.code !== '23505') throw error;
  // A lost response / duplicate request is successful only after the
  // same account's row has been read back from the server.
  const request = await readAccountDeletionRequest(userId);
  if (!request) throw new Error('Request not confirmed');
  return request;
}
