import type { SupabaseClient } from '@supabase/supabase-js';

/** Only the authenticated owner's still-open, unjoined duels can be cancelled. */
export type HostedOpenDuel = Readonly<{
  id: string;
  hostUserId: string;
  distanceMeters: number;
  createdAt: string | null;
}>;

export type CancelHostedDuelResult =
  | { status: 'cancelled' }
  | { status: 'not-cancelled'; reason: 'not-open-or-forbidden' | 'permission' | 'network' | 'server' };

type DuelClient = Pick<SupabaseClient, 'from'>;

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function listHostedOpenDuels(client: DuelClient, hostUserId: string): Promise<HostedOpenDuel[]> {
  if (!isUuid(hostUserId)) return [];
  const { data, error } = await client.from('duels')
    .select('id, host_user_id, target_distance_m, created_at')
    .eq('host_user_id', hostUserId)
    .eq('status', 'open')
    .is('challenger_user_id', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? [])
    .filter(row => typeof row.id === 'string' && isUuid(row.id) && row.host_user_id === hostUserId)
    .map(row => ({
      id: row.id,
      hostUserId: row.host_user_id,
      distanceMeters: Number.isFinite(row.target_distance_m) && row.target_distance_m > 0
        ? row.target_distance_m : 100,
      createdAt: typeof row.created_at === 'string' ? row.created_at : null,
    }));
}

/**
 * A confirmed cancellation must return the affected row id. PostgREST may
 * return HTTP 200 and zero rows for an RLS rejection or a concurrent join.
 * Never remove a race from UI on zero rows or an error.
 */
export async function cancelHostedOpenDuel(
  client: DuelClient, duelId: string, hostUserId: string,
): Promise<CancelHostedDuelResult> {
  if (!isUuid(duelId) || !isUuid(hostUserId)) return { status: 'not-cancelled', reason: 'not-open-or-forbidden' };
  try {
    const { data, error } = await client.from('duels')
      .update({ status: 'cancelled' })
      .eq('id', duelId)
      .eq('host_user_id', hostUserId)
      .eq('status', 'open')
      .is('challenger_user_id', null)
      .select('id, status');
    if (error) {
      const code = typeof error.code === 'string' ? error.code : '';
      return { status: 'not-cancelled', reason: code === '42501' || code === 'PGRST301'
        ? 'permission' : error.message?.toLowerCase().includes('fetch') ? 'network' : 'server' };
    }
    return data?.length === 1 && data[0].id === duelId && data[0].status === 'cancelled'
      ? { status: 'cancelled' }
      : { status: 'not-cancelled', reason: 'not-open-or-forbidden' };
  } catch {
    return { status: 'not-cancelled', reason: 'network' };
  }
}

export function cancelHostedDuelMessage(result: CancelHostedDuelResult): string {
  if (result.status === 'cancelled') return 'Dein Rennen wurde erfolgreich abgesagt.';
  switch (result.reason) {
    case 'not-open-or-forbidden':
      return 'Rennen nicht abgesagt: Es ist möglicherweise nicht mehr offen, bereits besetzt oder nicht deinem Konto zugeordnet.';
    case 'permission':
      return 'Rennen nicht abgesagt: Die Sitzung oder Datenbankberechtigung muss überprüft werden. Bitte erneut anmelden.';
    case 'network':
      return 'Rennen nicht abgesagt: Keine Verbindung zur Datenbank. Bitte Internet prüfen und wiederholen.';
    default:
      return 'Rennen nicht abgesagt: Der Server hat die Änderung abgelehnt. Bitte später erneut versuchen.';
  }
}
