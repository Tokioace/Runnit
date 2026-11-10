/**
 * Keeps the display awake while an experiment or race runs in the foreground.
 * This does not provide background motion access or override the iOS side button.
 * Platform calls are injected so lifecycle and failure cases can be tested.
 */
export type ScreenWakeLockStatus =
  | 'requesting' | 'held' | 'blocked' | 'unsupported' | 'hidden' | 'released';

export interface ScreenWakeLockHandle {
  readonly released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
  removeEventListener(type: 'release', listener: () => void): void;
}

export interface ScreenWakeLockSource {
  isSupported(): boolean;
  isVisible(): boolean;
  request(): Promise<ScreenWakeLockHandle>;
  subscribeVisibility(listener: () => void): () => void;
}

/**
 * Own exactly one screen wake lock. Release on teardown; retry when the page
 * becomes visible again. Failed requests are not retried in a busy loop.
 */
export function keepScreenAwake(
  source: ScreenWakeLockSource,
  onStatus: (status: ScreenWakeLockStatus) => void
): () => void {
  let closed = false;
  let requesting = false;
  let retryAfterPending = false;
  let held: ScreenWakeLockHandle | null = null;

  const report = (status: ScreenWakeLockStatus) => {
    if (!closed) onStatus(status);
  };
  const onRelease = () => {
    held = null;
    report(source.isVisible() ? 'released' : 'hidden');
  };

  const acquire = async (): Promise<void> => {
    if (closed) return;
    if (!source.isSupported()) { report('unsupported'); return; }
    if (!source.isVisible()) { report('hidden'); return; }
    if (held && !held.released) return;
    if (requesting) { retryAfterPending = true; return; }
    requesting = true;
    report('requesting');
    try {
      const next = await source.request();
      if (closed || !source.isVisible()) {
        await next.release();
        return;
      }
      held = next;
      next.addEventListener('release', onRelease);
      report('held');
    } catch {
      report('blocked');
    } finally {
      requesting = false;
      if (retryAfterPending) {
        retryAfterPending = false;
        if (!closed && source.isVisible() && !held) void acquire();
      }
    }
  };

  const onVisibility = () => {
    if (!source.isVisible()) {
      report('hidden');
    } else {
      void acquire();
    }
  };
  const unsubscribe = source.subscribeVisibility(onVisibility);
  void acquire();

  return () => {
    if (closed) return;
    closed = true;
    unsubscribe();
    if (held) {
      const previous = held;
      held = null;
      previous.removeEventListener('release', onRelease);
      void previous.release().catch(() => {});
    }
  };
}

export function screenWakeLockMessage(status: ScreenWakeLockStatus): string {
  switch (status) {
    case 'requesting': return 'Bildschirm-Wachhaltung wird aktiviert …';
    case 'held': return 'Bildschirm bleibt automatisch an. Bitte nicht mit der Seitentaste sperren.';
    case 'hidden': return 'App im Hintergrund: iOS kann GPS- und Bewegungssensoren anhalten. Messung möglicherweise unterbrochen.';
    case 'blocked': return 'Bildschirm-Wachhaltung wurde von iOS abgelehnt. Energiesparmodus/Akkustand prüfen; Bildschirm selbst eingeschaltet lassen.';
    case 'released': return 'Bildschirm-Wachhaltung wurde beendet. Bildschirm aktiv lassen; bei Sperre können Messwerte fehlen.';
    case 'unsupported': return 'Dieser Browser kann die automatische Bildschirmsperre nicht verhindern. Bildschirm eingeschaltet lassen.';
  }
}
