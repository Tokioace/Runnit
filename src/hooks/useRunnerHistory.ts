import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFinishRefresh } from '../lib/finishRefresh';
import { supabase } from '../lib/supabaseClient';
import { mapWithConcurrency } from '../lib/mapWithConcurrency';
import {
  calculateActivityTotals, currentLocalWeekStart, raceHistoryFromServer, archivedPersonalTimes, hasUniqueOwnedHistoryRows, hasRequestedDuelMetadata, hasValidGhostHistoryMeasurements,
  type StoredArchivedPersonalTime,
  type PairedResult, type RaceHistoryItem, type StoredDuel,
  type StoredDuelResult, type StoredGhostSession,
} from '../lib/runnerHistory';

type HistoryState = {
  ownerId: string | null;
  races: RaceHistoryItem[];
  ghostSessions: StoredGhostSession[];
  loading: boolean; error: string | null;
};
const EMPTY: HistoryState = { ownerId: null, races: [], ghostSessions: [], loading: false, error: null };
const LOADING: HistoryState = { ...EMPTY, loading: true };

/** Loads only the authenticated player's persisted data. No demo data.
 * Opponent outcomes come from the authorized get_duel_results RPC.
 * A failed request stays visible as an error instead of becoming false zeroes. */
export function useRunnerHistory(userId: string | null | undefined) {
  const [state, setState] = useState<HistoryState>(() => userId ? { ...LOADING, ownerId: userId } : EMPTY);
  const requestRefresh = useRef<(() => void) | null>(null);
  const [clockRevision, tickClock] = useState(0);

  const refresh = useCallback(() => requestRefresh.current?.(), []);

  useEffect(() => {
    if (!userId) {
      setState(EMPTY);
      return;
    }
    let active = true;
    async function read() {
      if (!active) return;
      setState(prev => ({ ...(prev.ownerId === userId ? prev : EMPTY), ownerId: userId!, loading: true, error: null }));
      try {
        const [ownResultResponse, ghostResponse] = await Promise.all([
          supabase.from('duel_results')
            .select('duel_id,user_id,time_ms,steps_count,distance_m,created_at')
            .eq('user_id', userId).order('created_at', { ascending: false }).limit(150),
          supabase.from('ghost_run_sessions')
            .select('id,user_id,created_at,target_distance_m,run_state,elapsed_ms,observed_distance_m,steps_count,motion_permission')
            .eq('user_id', userId).order('created_at', { ascending: false }).limit(150),
        ]);
        if (!active) return;
        if (ownResultResponse.error) throw ownResultResponse.error;
        if (ghostResponse.error) throw ghostResponse.error;
        if (!Array.isArray(ownResultResponse.data) || !Array.isArray(ghostResponse.data)) {
          throw new Error('Invalid history response');
        }
        if (!hasUniqueOwnedHistoryRows(ownResultResponse.data, 'duel_id', userId!) ||
            !hasUniqueOwnedHistoryRows(ghostResponse.data, 'id', userId!)) {
          throw new Error('Contradictory personal history response');
        }
        if (!hasValidGhostHistoryMeasurements(ghostResponse.data)) throw new Error('Invalid Ghost Run measurement history');
        const own = ownResultResponse.data as StoredDuelResult[];
        const ids = Array.from(new Set(own.map(row => row.duel_id).filter(Boolean)));
        let duels: StoredDuel[] = [];
        if (ids.length) {
          const response = await supabase.from('duels')
            .select('id,status,target_distance_m,host_user_id,challenger_user_id,created_at')
            .in('id', ids);
          if (!active) return;
          if (response.error) throw response.error;
          if (!Array.isArray(response.data)) throw new Error('Invalid duel history response');
          if (!hasRequestedDuelMetadata(response.data, ids, userId!)) throw new Error('Contradictory duel history response');
          duels = response.data as StoredDuel[];
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
          if (!Array.isArray(response.data)) throw new Error('Invalid paired history response');
          pairedResults.set(completed[i].id, response.data as PairedResult[]);
        }
        let archive: RaceHistoryItem[] = [];
        if (import.meta.env.VITE_ACCOUNT_DELETION_REQUESTS_ENABLED === 'true') {
          const response = await supabase.from('archived_personal_duel_times')
            .select('id,user_id,occurred_at,target_distance_m,time_ms,steps_count,distance_m')
            .eq('user_id', userId).order('occurred_at', { ascending:false }).limit(150);
          if (response.error) throw response.error;
          if (!active) return;
          if (!Array.isArray(response.data)) throw new Error('Invalid archived history response');
          if (!hasUniqueOwnedHistoryRows(response.data, 'id', userId!)) throw new Error('Contradictory archived history response');
          archive = archivedPersonalTimes(response.data as StoredArchivedPersonalTime[]);
        }
        if (active) setState({
          ownerId: userId!,
          races: [...raceHistoryFromServer(userId!, own, duels, pairedResults), ...archive]
            .sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt)).slice(0,150),
          ghostSessions: ghostResponse.data as StoredGhostSession[],
          loading: false, error: null,
        });
      } catch {
        if (active) setState({
          ownerId: userId!,
          races: [], ghostSessions: [], loading: false,
          error: 'Deine gespeicherten Ergebnisse konnten nicht geladen werden. Bitte erneut versuchen.',
        });
      }
    }
    const queue = createFinishRefresh(read, () => {});
    const request = () => { void queue.refresh(true); };
    requestRefresh.current = request;
    void queue.refresh();
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      active = false;
      queue.close();
      if (requestRefresh.current === request) requestRefresh.current = null;
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [userId, refresh]);

  // Calendar boundaries and clock corrections must update existing records
  // even when the screen stays open. This clock does not trigger network reads.
  useEffect(() => {
    if (!userId) return;
    const tick = () => {
      if (document.visibilityState === 'visible') tickClock(n => n + 1);
    };
    const timer = window.setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [userId]);

  // Effects run after render. Never expose a previous account's history even
  // for the first render after a switch or while the new account is loading.
  const visibleState = state.ownerId === (userId || null) ? state : userId ? LOADING : EMPTY;
  const now = useMemo(() => new Date(), [visibleState.races, visibleState.ghostSessions, clockRevision]);
  const totals = useMemo(() => {
    return calculateActivityTotals(visibleState.races, visibleState.ghostSessions, currentLocalWeekStart(now), now.getTime());
  }, [visibleState.races, visibleState.ghostSessions, now]);

  return { races: visibleState.races, ghostSessions: visibleState.ghostSessions,
    loading: visibleState.loading, error: visibleState.error, totals, refresh, now };
}

