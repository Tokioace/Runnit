type Stop = (preserveGo?: boolean) => void;

/** Own a single scheduled countdown. Permission and audio resume may finish
 * after the countdown has been removed, so retire the continuation on close. */
export function createCountdownAudioSession(
  schedule: () => Stop | null,
  unlock: () => Promise<boolean>,
) {
  let closed = false;
  let pending = false;
  let stop: Stop | null = null;
  const start = () => {
    if (!closed && !stop) stop = schedule();
  };
  return {
    start,
    async activate() {
      if (closed || pending) return;
      pending = true;
      try {
        // Keep the initial unlock invocation synchronous with the tap.
        const ready = await unlock();
        if (ready) start();
      } catch { /* Audio failure must not affect a race. */ }
      finally { pending = false; }
    },
    close(preserveGo = false) {
      if (closed) return;
      closed = true;
      const previous = stop;
      stop = null;
      previous?.(preserveGo);
    },
  };
}
