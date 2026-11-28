import React, { useLayoutEffect, useRef, useState } from 'react';
import { createMeasurementLifetime } from '../../lib/measurementLifetime';

export type ReadyLobbyProps = {
  hostName: string;
  challengerName: string;
  hostReady: boolean;
  challengerReady: boolean;
  isHost: boolean;
  targetDistanceM: number;
  readyBusy: boolean;
  readyError: string | null;
  startMissed?: boolean;
  soundEnabled: boolean;
  onReady: () => void;
  onSoundToggle: () => void;
  onBack: () => void;
  onAbort: () => Promise<void>;
};

function RunnerCard({ name, role, ready, isMe, number }: {
  name: string; role: string; ready: boolean; isMe: boolean; number: '01' | '02';
}) {
  return (
    <div className={'race-arcade-player ' + (ready ? 'is-ready' : '')}>
      <div className="race-arcade-avatar" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase() || 'R'}</div>
      <div className="race-arcade-player-info">
        <span className="race-arcade-eyebrow">{role}{isMe ? ' · DU' : ''}</span>
        <strong className="race-arcade-player-name">{name}</strong>
        <span className={'race-arcade-status ' + (ready ? 'ready' : 'waiting')}>
          <span aria-hidden="true">{ready ? '✓ ' : '◌ '}</span>{ready ? 'READY' : 'WARTET AUF READY'}
        </span>
      </div>
      <span className="race-arcade-player-number" aria-hidden="true">{number}</span>
    </div>
  );
}

/** Fully optional presentation layer; readiness is still server-authoritative. */
export default function ReadyLobby(props: ReadyLobbyProps) {
  const { hostName, challengerName, hostReady, challengerReady, isHost, targetDistanceM,
    readyBusy, readyError, startMissed = false, soundEnabled, onReady: requestReady, onSoundToggle, onBack: returnToMap, onAbort } = props;
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [abortError, setAbortError] = useState<string | null>(null);
  const lifetime = useRef(createMeasurementLifetime());
  const abortPendingRef = useRef(false);
  useLayoutEffect(() => {
    lifetime.current.open();
    abortPendingRef.current = false;
    return () => lifetime.current.close();
  }, []);
  const confirmExit = async () => {
    if (!lifetime.current.isActive() || abortPendingRef.current || readyBusy) return;
    const isLive = lifetime.current.capture();
    abortPendingRef.current = true;
    setAborting(true);
    setAbortError(null);
    try {
      await onAbort();
    } catch {
      if (!isLive()) return;
      setAbortError('Rennabbruch nicht bestätigt. Bitte Verbindung prüfen und erneut versuchen.');
    } finally {
      if (isLive()) {
        abortPendingRef.current = false;
        setAborting(false);
      }
    }
  };
  const mineReady = isHost ? hostReady : challengerReady;
  const onReady = () => {
    if (!lifetime.current.isActive() || startMissed || mineReady || readyBusy || confirmAbort || abortPendingRef.current) return;
    requestReady();
  };
  const onBack = () => {
    if (!lifetime.current.isActive() || confirmAbort || abortPendingRef.current) return;
    returnToMap();
  };
  return (
    <div className="race-arcade-screen race-arcade-lobby" role="dialog" aria-modal="true"
      aria-labelledby="arcade-lobby-title">
      <div className="race-arcade-light race-arcade-light-a" aria-hidden="true" />
      <div className="race-arcade-light race-arcade-light-b" aria-hidden="true" />
      <div className="race-arcade-shell">
        <div className="race-arcade-topline">
          <span>RUNNIT // READY LOBBY</span>
          <button className="race-arcade-sound" type="button" onClick={onSoundToggle}
            aria-label={soundEnabled ? 'Ton ausschalten' : 'Ton einschalten'}
            aria-pressed={soundEnabled}>{soundEnabled ? '♪ TON AN' : 'TON AUS'}</button>
        </div>
        <div className="race-arcade-headline">
          <span className="race-arcade-flag" aria-hidden="true">▰ ▰ ▰</span>
          <h2 id="arcade-lobby-title">GEGNER<br />GEFUNDEN!</h2>
          <div className="race-arcade-duel-tag">1V1 DUELL <b>· {targetDistanceM} M</b></div>
        </div>
        <div className="race-arcade-versus">
          <RunnerCard role="HOST" name={hostName} ready={hostReady} isMe={isHost} number="01" />
          <div className="race-arcade-vs" aria-hidden="true">VS</div>
          <RunnerCard role="CHALLENGER" name={challengerName} ready={challengerReady}
            isMe={!isHost} number="02" />
        </div>
        <div className="race-arcade-lobby-footer">
          <p className="race-arcade-help">
            <span aria-hidden="true">◆</span> {startMissed
              ? 'RENNSTART VERPASST. DUELL ABBRECHEN UND EIN NEUES RENNEN STARTEN.'
              : <>START ERST WENN <strong>BEIDE</strong> READY SIND</>}
          </p>
          <button type="button" className="race-arcade-primary" onClick={onReady}
            disabled={startMissed || mineReady || readyBusy || confirmAbort || aborting}>
            {startMissed ? 'START VERPASST' : readyBusy ? 'READY WIRD BESTÄTIGT…' : mineReady ? '✓ DU BIST READY — WARTE AUF GEGNER' : 'ICH BIN READY »'}
          </button>
          {readyError && !startMissed && <p className="race-arcade-error" role="alert">{readyError}</p>}
          {confirmAbort ? (
            <div className="race-arcade-confirm" role="alertdialog" aria-label="Duell abbrechen">
              <p>WIRKLICH ABBRECHEN? Das Rennen endet für beide Spieler und wird nicht gewertet.</p>
              <div className="race-arcade-confirm-actions">
                <button type="button" disabled={aborting} onClick={() => setConfirmAbort(false)}>NEIN, WEITER</button>
                <button type="button" disabled={aborting || readyBusy} onClick={() => { void confirmExit(); }}>
                  {aborting ? 'WIRD ABGEBROCHEN…' : 'JA, DUELL ABBRECHEN'}
                </button>
              </div>
              {abortError && <p role="alert" className="race-arcade-error">{abortError}</p>}
            </div>
          ) : (
            <button className="race-arcade-danger-link" type="button" onClick={() => setConfirmAbort(true)}>
              DUELL FÜR BEIDE ABBRECHEN
            </button>
          )}
          <button className="race-arcade-link" type="button" disabled={confirmAbort || aborting} onClick={onBack}>ZUR KARTE · LOBBY BLEIBT AKTIV</button>
        </div>
      </div>
    </div>
  );
}
