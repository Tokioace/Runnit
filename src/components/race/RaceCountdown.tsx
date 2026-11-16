import React, { useEffect, useRef, useState } from 'react';
import { scheduleArcadeStartSfx, unlockRaceAudio } from '../../lib/arcadeRaceAudio';
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
  wakeStatus: ScreenWakeLockStatus | 'idle'; onDone: () => void };

export default function RaceCountdown({ startsAt, targetDistanceM, soundEnabled, wakeStatus, onDone }: Props) {
  const [remaining, setRemaining] = useState(() => countdownSecond(startsAt, Date.now()));
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finishedRef = useRef(false);
  useEffect(() => {
    finishedRef.current = false;
    const tick = () => {
      const next = countdownSecond(startsAt, Date.now());
      setRemaining(value => value === next ? value : next);
      if (next === 0 && !finishedRef.current) {
        finishedRef.current = true;
        doneRef.current();
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
  useEffect(() => {
    if (!soundEnabled) return;
    return scheduleArcadeStartSfx(startsAt);
  }, [startsAt, soundEnabled]);
  const color = ARCADE_COUNTDOWN_COLORS[ARCADE_COUNTDOWN_SECONDS - Math.max(1, remaining)];
  const progress = Math.max(0, Math.min(100, (startsAt - Date.now()) / (ARCADE_COUNTDOWN_SECONDS * 1000) * 100));
  return (
    <div className="race-arcade-screen race-arcade-countdown" role="status"
      aria-label={`Rennstart in ${remaining} Sekunden`}>
      <div className="race-arcade-light race-arcade-light-a" aria-hidden="true" />
      <div className="race-arcade-light race-arcade-light-b" aria-hidden="true" />
      <div className="race-arcade-shell">
        <div className="race-arcade-topline"><span>RUNNIT // RACE CONTROL</span><span>1V1 LIVE</span></div>
        <div className="race-arcade-headline">
          <h2>START YOUR ENGINES</h2>
          <div className="race-arcade-duel-tag">1V1 DUELL <b>· {targetDistanceM} M</b></div>
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
            onClick={() => { unlockRaceAudio(); scheduleArcadeStartSfx(startsAt); }}>
            TON AKTIVIEREN (iPHONE)
          </button>}
        </div>
      </div>
    </div>
  );
}
