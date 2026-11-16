import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cancels a matched race for BOTH participants. Unlike closing the local
 * race overlay, this RPC releases the server's active-duel lock.
 * Must only be called for a confirmed UUID and with an authenticated session.
 */
export async function abortMatchedDuel(supabase: SupabaseClient, duelId: string): Promise<{ id: string; status: 'abandoned' }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(duelId)) {
    throw new Error('Ungültige Renn-ID');
  }
  const { data, error } = await supabase.rpc('abort_duel', { p_duel_id: duelId });
  if (error) throw error;
  if (!data || data.id !== duelId || data.status !== 'abandoned') {
    throw new Error('Rennabbruch wurde nicht vom Server bestätigt');
  }
  return { id: data.id, status: 'abandoned' };
}
