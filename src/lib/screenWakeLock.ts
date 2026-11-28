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
  let held: { handle: ScreenWakeLockHandle; listener: () => void } | null = null;
  let visibilityGeneration = 0;

  const report = (status: ScreenWakeLockStatus) => {
    if (!closed) onStatus(status);
  };
  const dropHeld = () => {
    const previous = held;
    held = null;
    if (previous) {
      previous.handle.removeEventListener('release', previous.listener);
      void previous.handle.release().catch(() => {});
    }
  };

  const acquire = async (): Promise<void> => {
    if (closed) return;
    if (!source.isSupported()) { report('unsupported'); return; }
    if (!source.isVisible()) { report('hidden'); return; }
    if (held && !held.handle.released) return;
    if (held) dropHeld();
    if (requesting) { retryAfterPending = true; return; }
    requesting = true;
    const generation = visibilityGeneration;
    report('requesting');
    try {
      const next = await source.request();
      if (closed || !source.isVisible() || generation !== visibilityGeneration) {
        await next.release().catch(() => {});
        return;
      }
      if (next.released) { report('released'); return; }
      const listener = () => {
        if (held?.handle !== next || held.listener !== listener) return;
        held = null;
        next.removeEventListener('release', listener);
        report(source.isVisible() ? 'released' : 'hidden');
      };
      held = { handle: next, listener };
      next.addEventListener('release', listener);
      if (next.released) listener();
      else report('held');
    } catch {
      if (generation === visibilityGeneration) report(source.isVisible() ? 'blocked' : 'hidden');
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
      // Release explicitly: browsers may not dispatch a release event before
      // hiding the page. Never claim a wake lock survives backgrounding.
      visibilityGeneration += 1;
      dropHeld();
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
    dropHeld();
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
