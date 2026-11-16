import React, { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getDuelResults } from '../../db/getDuelResults';
import { playArcadeFinishSfx } from '../../lib/arcadeRaceAudio';

import { determineDuelOutcome } from '../../lib/duelOutcome';

export type DuelResultRow = {
  user_id: string;
  username: string | null;
  time_ms: number;
  distance_m?: number | null;
  steps_count?: number | null;
  max_speed_mps?: number | null;
};

type Status = 'loading' | 'matched' | 'completed' | 'abandoned' | 'unavailable';
type Props = {
  supabase: SupabaseClient;
  duelId: string;
  userId: string;
  targetDistanceM: number;
  isDemo: boolean;
  submissionError: string | null;
  onRetrySubmit: () => Promise<void>;
  onAbort: () => Promise<void>;
  onClose: () => void;
};

function displayTime(ms: number | null | undefined) {
  return Number.isFinite(ms) && (ms ?? 0) > 0 ? ((ms as number) / 1000).toFixed(2) + 's' : '—';
}

export default function DuelFinishScreen({
  supabase, duelId, userId, targetDistanceM, isDemo, submissionError,
  onRetrySubmit, onAbort, onClose,
}: Props) {
  const [status, setStatus] = useState<Status>(isDemo ? 'completed' : 'loading');
  const [rows, setRows] = useState<DuelResultRow[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [challengerId, setChallengerId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);
  const [abortBusy, setAbortBusy] = useState(false);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [abortError, setAbortError] = useState<string | null>(null);
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    playArcadeFinishSfx();
  }, []);

  useEffect(() => {
    if (isDemo) return;
    let active = true;
    const refresh = async () => {
      const [duelResponse, resultsResponse] = await Promise.all([
        supabase.from('duels')
          .select('id, status, host_user_id, challenger_user_id')
          .eq('id', duelId).maybeSingle(),
        getDuelResults(supabase, duelId),
      ]);
      if (!active) return;
      if (duelResponse.error || resultsResponse.error || !duelResponse.data) {
        setFetchError('Rennstatus konnte nicht geladen werden. Die Anzeige versucht es erneut.');
        return;
      }
      const duel = duelResponse.data;
      if (duel.host_user_id !== userId && duel.challenger_user_id !== userId) {
        setFetchError('Du bist kein Teilnehmer dieses Rennens.');
        return;
      }
      setHostId(duel.host_user_id);
      setChallengerId(duel.challenger_user_id);
      setStatus(duel.status === 'completed' ? 'completed'
        : duel.status === 'matched' ? 'matched'
          : duel.status === 'abandoned' ? 'abandoned' : 'unavailable');
      setRows((resultsResponse.data ?? []) as DuelResultRow[]);
      setFetchError(null);
    };
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 3000);
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [supabase, duelId, userId, isDemo]);

  const uniqueResults = rows.filter(row =>
    typeof row.user_id === 'string' &&
    (row.user_id === hostId || row.user_id === challengerId) &&
    Number.isFinite(row.time_ms) && row.time_ms > 0);
  const outcome = determineDuelOutcome(uniqueResults, userId, status);
  const completed = isDemo || outcome !== 'pending';
  const mine = uniqueResults.find(row => row.user_id === userId);
  const other = uniqueResults.find(row => row.user_id !== userId);
  const resultTitle = isDemo ? 'TESTLAUF!' : outcome === 'won' ? 'DU GEWINNST!'
    : outcome === 'lost' ? 'DU VERLIERST!' : outcome === 'tie' ? 'UNENTSCHIEDEN!'
      : 'ZIEL ERREICHT!';
  const retrySubmission = async () => {
    if (retryBusy) return;
    setRetryBusy(true);
    try { await onRetrySubmit(); }
    finally { setRetryBusy(false); }
  };
  const abort = async () => {
    if (abortBusy) return;
    setAbortBusy(true);
    setAbortError(null);
    try { await onAbort(); }
    catch {
      setAbortError('Abbruch nicht bestätigt. Prüfe deine Verbindung und versuche es erneut.');
      setAbortBusy(false);
    }
  };

  return (
    <div className="race-arcade-screen race-arcade-finish"
      role="dialog" aria-modal="true" aria-labelledby="duel-finish-title">
      <div className="race-arcade-light race-arcade-light-a" aria-hidden="true" />
      <div className="race-arcade-light race-arcade-light-b" aria-hidden="true" />
      <div className="race-arcade-shell">
        <div className="race-arcade-topline"><span>RUNNIT // RACE RESULTS</span><span>1V1</span></div>
        <div className="race-arcade-finish-flag" aria-hidden="true">🏁</div>
        <h2 id="duel-finish-title" className="race-arcade-finish-title">{resultTitle}</h2>
        <p className="race-arcade-sound-caption">
          {completed ? 'RESULTS // RACE COMPLETE' : 'FINISH // WAITING FOR RIVAL'}
        </p>

        <div className="race-arcade-finish-result">
          <p className="race-arcade-finish-label">1V1 DUELL · {targetDistanceM} M</p>
          {completed && !isDemo ? (
            <p className="race-arcade-finish-time">{displayTime(mine?.time_ms)}</p>
          ) : (
            <p className="race-arcade-finish-time">{isDemo ? 'DEMO' : 'FINISH'}</p>
          )}
          <p className="race-arcade-finish-label">
            {isDemo ? 'NICHT GEWERTETER TESTLAUF' : completed ? 'DEINE ZEIT' : 'ERGEBNIS WIRD ERMITTELT'}
          </p>
        </div>

        {!isDemo && (
          <div className="race-arcade-result-versus" aria-live="polite">
            <div className={'race-arcade-result-runner ' + (outcome === 'won' ? 'winner' : '')}>
              <span>DU · {mine?.username || 'RUNNER'}</span>
              <strong>{displayTime(mine?.time_ms)}</strong>
              <small>{outcome === 'won' ? '1. PLATZ' : outcome === 'tie' ? 'GLEICHSTAND' : 'DEINE ZEIT'}</small>
            </div>
            <div className="race-arcade-result-vs">VS</div>
            <div className={'race-arcade-result-runner ' + (outcome === 'lost' ? 'winner' : '')}>
              <span>GEGNER · {other?.username || 'RUNNER'}</span>
              <strong>{displayTime(other?.time_ms)}</strong>
              <small>{outcome === 'lost' ? '1. PLATZ' : outcome === 'tie' ? 'GLEICHSTAND' : 'GEGNERZEIT'}</small>
            </div>
          </div>
        )}

        {!completed && (
          <p className="race-arcade-finish-note" role="status">
            {status === 'matched'
              ? mine ? 'DEINE ZEIT GESPEICHERT. WIR WARTEN AUF DEN ZIELLAUF DEINES GEGNERS.'
                : 'DEINE ZIELZEIT WIRD ÜBERPRÜFT.'
              : 'WIR LADEN DIE BESTÄTIGTEN ERGEBNISSE BEIDER SPIELER.'}
            {' '}Der Ergebnisbildschirm bleibt offen, bis das gemeinsame Rennen abgeschlossen ist.
          </p>
        )}
        {fetchError && <p className="race-arcade-error" role="alert">{fetchError}</p>}
        {submissionError && !completed && (
          <div className="race-arcade-result-retry">
            <p className="race-arcade-error" role="alert">{submissionError}</p>
            <button type="button" onClick={() => { void retrySubmission(); }} disabled={retryBusy}
              className="race-arcade-danger-link">
              {retryBusy ? 'ERNEUTER VERSUCH …' : 'ZIELZEIT ERNEUT SPEICHERN'}
            </button>
          </div>
        )}
        <p className="race-arcade-finish-note">
          GPS- und Zeitmessung sind experimentell. Sieger und Verlierer werden
          anhand der gespeicherten Zeiten angezeigt, nicht als verifizierte Ranglistenwertung.
        </p>
        {completed ? (
          <button type="button" className="race-arcade-primary" onClick={onClose}>
            ERGEBNIS SCHLIESSEN · ZUR KARTE »
          </button>
        ) : status === 'abandoned' ? (
          <button type="button" className="race-arcade-primary" onClick={onClose}>
            ABGEBROCHEN · ZUR KARTE »
          </button>
        ) : (
          <div className="race-arcade-finish-actions">
            {confirmAbort ? (
              <div className="race-arcade-confirm" role="alertdialog" aria-label="Warten auf Gegner abbrechen">
                <p>DUELL FÜR BEIDE ABBRECHEN? Bisherige Zeiten werden nicht gewertet.</p>
                <div className="race-arcade-confirm-actions">
                  <button type="button" disabled={abortBusy} onClick={() => setConfirmAbort(false)}>NEIN</button>
                  <button type="button" disabled={abortBusy} onClick={() => { void abort(); }}>
                    {abortBusy ? 'WIRD ABGEBROCHEN…' : 'JA, ABBRECHEN'}
                  </button>
                </div>
                {abortError && <p className="race-arcade-error" role="alert">{abortError}</p>}
              </div>
            ) : (
              <button type="button" className="race-arcade-danger-link" onClick={() => setConfirmAbort(true)}>
                DUELL ABBRECHEN, STATT ZU WARTEN
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
