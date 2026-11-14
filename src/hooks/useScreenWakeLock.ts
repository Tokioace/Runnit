import { useEffect, useState } from 'react';
import { keepScreenAwake, type ScreenWakeLockStatus, type ScreenWakeLockSource } from '../lib/screenWakeLock';

/** Browser-only screen wake lock for the duration of a race or field test. */
export function useScreenWakeLock(enabled: boolean): ScreenWakeLockStatus | 'idle' {
  const [status, setStatus] = useState<ScreenWakeLockStatus | 'idle'>('idle');

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    const source: ScreenWakeLockSource = {
      isSupported: () => window.isSecureContext && typeof navigator.wakeLock?.request === 'function',
      isVisible: () => document.visibilityState === 'visible',
      request: () => navigator.wakeLock.request('screen'),
      subscribeVisibility: listener => {
        document.addEventListener('visibilitychange', listener);
        return () => document.removeEventListener('visibilitychange', listener);
      },
    };
    return keepScreenAwake(source, setStatus);
  }, [enabled]);

  return enabled ? status : 'idle';
}
