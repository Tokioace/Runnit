import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createMeasurementLifetime } from '../../lib/measurementLifetime';
import { scheduleArcadeStartSfx, unlockRaceAudio } from '../../lib/arcadeRaceAudio';
import { createCountdownAudioSession } from '../../lib/countdownAudioSession';
import { screenWakeLockMessage, type ScreenWakeLockStatus } from '../../lib/screenWakeLock';

export const ARCADE_COUNTDOWN_COLORS = [
  '#4cf5ff', '#b9ff2d', '#ffe937', '#ff9f25', '#ff4585',
  '#ff45e2', '#bb88ff', '#467eff', '#22ead3', '#f6fcff',
] as const;
export const ARCADE_COUNTDOWN_SECONDS = 10;

export function countdownSecond(startsAt: number, now: number): number {
  if (!Number.isFinite(startsAt) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.min(ARCADE_COUNTDOWN_SECONDS, Math.ceil((startsAt - now) / 1000)));
}

type Props = { startsAt: number; targetDistanceM: number; soundEnabled: boolean;
  mode?: 'duel' | 'ghost'; wakeStatus: ScreenWakeLockStatus | 'idle'; onDone: () => boolean; onAbort: () => Promise<void> };

export default function RaceCountdown({ startsAt, targetDistanceM, soundEnabled, wakeStatus, onDone, onAbort, mode = 'duel' }: Props) {
  const [remaining, setRemaining] = useState(() => countdownSecond(startsAt, Date.now()));
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [abortError, setAbortError] = useState<string | null>(null);
  const lifetime = useRef(createMeasurementLifetime());
  const abortPendingRef = useRef(false);
  const finishedRef = useRef(false);
  const handedOffStart = useRef<number | null>(null);
  useLayoutEffect(() => {
    lifetime.current.open();
    abortPendingRef.current = false;
    finishedRef.current = false;
    handedOffStart.current = null;
    setConfirmAbort(false);
    setAborting(false);
    setAbortError(null);
    return () => lifetime.current.close();
  }, [startsAt]);
  const confirmExit = async () => {
    if (!lifetime.current.isActive() || abortPendingRef.current || finishedRef.current) return;
    const isLive = lifetime.current.capture();
    abortPendingRef.current = true;
    setAborting(true);
    setAbortError(null);
    try {
      await onAbort();
    } catch {
      if (!isLive() || finishedRef.current) return;
      abortPendingRef.current = false;
      setAbortError('Rennabbruch nicht bestätigt. Bitte erneut versuchen.');
      setAborting(false);
    }
  };
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const isLive = lifetime.current.capture();
    const tick = () => {
      if (!isLive()) return;
      const next = countdownSecond(startsAt, Date.now());
      setRemaining(value => value === next ? value : next);
      if (next === 0 && !finishedRef.current) {
        finishedRef.current = true;
        if (doneRef.current()) handedOffStart.current = startsAt;
      }
    };
    tick();
    const timer = window.setInterval(tick, 35);
    const visibility = () => tick();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [startsAt]);
  const audioSession = useRef<ReturnType<typeof createCountdownAudioSession> | null>(null);
  useEffect(() => {
    if (!soundEnabled) return;
    const session = createCountdownAudioSession(() => scheduleArcadeStartSfx(startsAt), unlockRaceAudio);
    audioSession.current = session;
    session.start();
    return () => {
      audioSession.current = null;
      session.close(handedOffStart.current === startsAt);
    };
  }, [startsAt, soundEnabled]);
  const color = ARCADE_COUNTDOWN_COLORS[ARCADE_COUNTDOWN_SECONDS - Math.max(1, remaining)];
  const progress = Math.max(0, Math.min(100, (startsAt - Date.now()) / (ARCADE_COUNTDOWN_SECONDS * 1000) * 100));
  return (
    <div className="race-arcade-screen race-arcade-countdown" role="status"
      aria-label={`Rennstart in ${remaining} Sekunden`}>
      <div className="race-arcade-light race-arcade-light-a" aria-hidden="true" />
      <div className="race-arcade-light race-arcade-light-b" aria-hidden="true" />
      <div className="race-arcade-shell">
        <div className="race-arcade-topline"><span>RUNNIT // RACE CONTROL</span><span>{mode === 'ghost' ? 'SOLO LIVE' : '1V1 LIVE'}</span></div>
        <div className="race-arcade-headline">
          <h2>START YOUR ENGINES</h2>
          <div className="race-arcade-duel-tag">{mode === 'ghost' ? 'GHOST RUN' : '1V1 DUELL'} <b>· {targetDistanceM} M</b></div>
        </div>
        <div className="race-arcade-count-center">
          <p className="race-arcade-caption">RENNEN STARTET IN</p>
          <div className="race-arcade-time-ring" style={{ '--count-glow': color } as React.CSSProperties}>
            <div className="race-arcade-number" key={remaining} style={{ color }}>{remaining || 'GO!'}</div>
          </div>
          <div className="race-arcade-phase">{remaining > 3 ? 'GET READY' : remaining > 1 ? 'READY' : remaining === 1 ? 'STEADY' : 'GO!'}</div>
          <div className="race-arcade-timer-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        </div>
        <div className="race-arcade-count-footer">
          <div className="race-arcade-color-strip" aria-hidden="true">
            {ARCADE_COUNTDOWN_COLORS.map((tone, index) => (
              <span key={tone} className={remaining === ARCADE_COUNTDOWN_SECONDS - index ? 'active' : ''}
                style={{ color: tone }}>{ARCADE_COUNTDOWN_SECONDS - index}</span>
            ))}
          </div>
          <p className="race-arcade-sound-caption">◖)) &nbsp; 3 · 2 · 1 &nbsp; — &nbsp; BEEP · BEEP · GOOOO!</p>
          {wakeStatus !== 'idle' && <p className="race-arcade-wake">{screenWakeLockMessage(wakeStatus)}</p>}
          {soundEnabled && <button type="button" className="race-arcade-link"
            onClick={() => { void audioSession.current?.activate(); }}>
            TON AKTIVIEREN (iPHONE)
          </button>}
          {confirmAbort ? (
            <div className="race-arcade-confirm" role="alertdialog" aria-label="Countdown abbrechen">
              <p>{mode === 'ghost' ? 'GHOST RUN ABBRECHEN?' : 'RENNEN FÜR BEIDE SPIELER ABBRECHEN?'}</p>
              <div className="race-arcade-confirm-actions">
                <button type="button" disabled={aborting} onClick={() => setConfirmAbort(false)}>NEIN</button>
                <button type="button" disabled={aborting} onClick={() => { void confirmExit(); }}>
                  {aborting ? 'WIRD ABGEBROCHEN…' : 'JA, ABBRECHEN'}
                </button>
              </div>
              {abortError && <p className="race-arcade-error" role="alert">{abortError}</p>}
            </div>
          ) : (
            <button type="button" className="race-arcade-danger-link" onClick={() => setConfirmAbort(true)}>
              COUNTDOWN ABBRECHEN
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
