import { useEffect, useRef, useState } from 'react';
import { OPEN_EVENT_LIFETIME_MS, openEventClockLabel, openEventMsLeft } from '../../lib/duelExpiry.ts';

type Props = {
  expiresAt: string;
  variant?: 'hud' | 'inline';
  onExpire?: () => void;
};

/** Isolated 1Hz island: the entire MapLibre/ArcadeMap view is NOT rerendered
 * every second, and the timer resumes from server time after iOS suspension. */
export default function OpenEventCountdown({ expiresAt, variant = 'inline', onExpire }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const expiredNotified = useRef(false);
  useEffect(() => {
    expiredNotified.current = false;
    const tick = () => setNowMs(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    const restore = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', restore);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', restore);
    };
  }, [expiresAt]);

  const remainingMs = openEventMsLeft(expiresAt, nowMs);
  useEffect(() => {
    if (remainingMs === 0 && !expiredNotified.current) {
      expiredNotified.current = true;
      onExpire?.();
    }
  }, [remainingMs, onExpire]);

  const label = openEventClockLabel(expiresAt, nowMs);
  const endingSoon = remainingMs > 0 && remainingMs <= 5 * 60_000;
  if (variant === 'inline') {
    return (
      <time dateTime={expiresAt} className={'runnit-open-countdown-inline' + (endingSoon ? ' is-urgent' : '')}
        role="timer" aria-live="off" title="Verbleibende Zeit, um diesem Rennen beizutreten">
        {remainingMs > 0 ? label : 'ABGELAUFEN'}
      </time>
    );
  }

  return (
    <div className={'runnit-open-countdown-hud' + (endingSoon ? ' is-urgent' : '')} aria-label="Zeit bis zum Ablauf deiner offenen Challenge">
      <div className="runnit-open-countdown-heading">
        <span className="runnit-open-countdown-led" aria-hidden="true" />
        <span>MEIN EVENT · ENDET IN</span>
        <time role="timer" aria-live="off" dateTime={expiresAt}>{remainingMs > 0 ? label : '00:00'}</time>
      </div>
      <div className="runnit-open-countdown-track" aria-hidden="true">
        <span style={{ width: Math.min(100, 100 * remainingMs / OPEN_EVENT_LIFETIME_MS) + '%' }} />
      </div>
    </div>
  );
}
