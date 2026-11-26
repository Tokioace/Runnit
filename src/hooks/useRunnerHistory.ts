import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mapWithConcurrency } from '../lib/mapWithConcurrency';
import {
  calculateActivityTotals, currentLocalWeekStart, raceHistoryFromServer, archivedPersonalTimes,
  type StoredArchivedPersonalTime,
  type PairedResult, type RaceHistoryItem, type StoredDuel,
  type StoredDuelResult, type StoredGhostSession,
} from '../lib/runnerHistory';

type HistoryState = {
  races: RaceHistoryItem[];
  ghostSessions: StoredGhostSession[];
  loading: boolean; error: string | null;
};
const EMPTY: HistoryState = { races: [], ghostSessions: [], loading: false, error: null };

/** Loads only the authenticated player's persisted data. No demo data.
 * Opponent outcomes come from the authorized get_duel_results RPC.
 * A failed request stays visible as an error instead of becoming false zeroes. */
export function useRunnerHistory(userId: string | null | undefined) {
  const [state, setState] = useState<HistoryState>(() => userId ? { ...EMPTY, loading: true } : EMPTY);
  const [revision, reload] = useState(0);

  const refresh = useCallback(() => reload(n => n + 1), []);

  useEffect(() => {
    if (!userId) {
      setState(EMPTY);
      return;
    }
    let active = true;
    setState(prev => ({ ...prev, loading: true, error: null }));
    async function read() {
      try {
        const [ownResultResponse, ghostResponse] = await Promise.all([
          supabase.from('duel_results')
            .select('duel_id,user_id,time_ms,steps_count,distance_m,created_at')
            .eq('user_id', userId).order('created_at', { ascending: false }).limit(150),
          supabase.from('ghost_run_sessions')
            .select('id,created_at,target_distance_m,run_state,elapsed_ms,observed_distance_m,steps_count,motion_permission')
            .eq('user_id', userId).order('created_at', { ascending: false }).limit(150),
        ]);
        if (!active) return;
        if (ownResultResponse.error) throw ownResultResponse.error;
        if (ghostResponse.error) throw ghostResponse.error;
        const own = (ownResultResponse.data ?? []) as StoredDuelResult[];
        const ids = Array.from(new Set(own.map(row => row.duel_id).filter(Boolean)));
        let duels: StoredDuel[] = [];
        if (ids.length) {
          const response = await supabase.from('duels')
            .select('id,status,target_distance_m,host_user_id,challenger_user_id,created_at')
            .in('id', ids);
          if (!active) return;
          if (response.error) throw response.error;
          duels = (response.data ?? []) as StoredDuel[];
        }
        const pairedResults = new Map<string, readonly PairedResult[]>();
        const completed = duels.filter(duel => duel.status === 'completed');
        // Cap simultaneous RPCs to avoid a burst of up to 150 requests on focus/reload.
        const pairResponses = await mapWithConcurrency(completed, 4, async duel => {
          if (!active) throw new Error('Retired history request');
          const response = await supabase.rpc('get_duel_results', { p_duel_id: duel.id });
          if (response.error) throw response.error;
          return response;
        });
        if (!active) return;
        for (let i = 0; i < completed.length; i++) {
          const response = pairResponses[i];
          if (response.error) throw response.error;
          pairedResults.set(completed[i].id, (response.data ?? []) as PairedResult[]);
        }
        let archive: RaceHistoryItem[] = [];
        if (import.meta.env.VITE_ACCOUNT_DELETION_REQUESTS_ENABLED === 'true') {
          const response = await supabase.from('archived_personal_duel_times')
            .select('id,occurred_at,target_distance_m,time_ms,steps_count,distance_m')
            .eq('user_id', userId).order('occurred_at', { ascending:false }).limit(150);
          if (response.error) throw response.error;
          if (!active) return;
          archive = archivedPersonalTimes((response.data ?? []) as StoredArchivedPersonalTime[]);
        }
        if (active) setState({
          races: [...raceHistoryFromServer(userId!, own, duels, pairedResults), ...archive]
            .sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).slice(0,150),
          ghostSessions: (ghostResponse.data ?? []) as StoredGhostSession[],
          loading: false, error: null,
        });
      } catch {
        if (active) setState({
          races: [], ghostSessions: [], loading: false,
          error: 'Deine gespeicherten Ergebnisse konnten nicht geladen werden. Bitte erneut versuchen.',
        });
      }
    }
    void read();
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [userId, revision, refresh]);

  const totals = useMemo(() => {
    const now = new Date();
    return calculateActivityTotals(state.races, state.ghostSessions, currentLocalWeekStart(now), now.getTime());
  }, [state.races, state.ghostSessions]);

  return { ...state, totals, refresh };
}

