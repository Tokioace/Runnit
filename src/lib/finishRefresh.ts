/** One in-flight finish read per mounted result screen.
 * A retired request may still complete, but must not trigger further reads
 * or report a late failure. The caller guards its success publication. */
export function createFinishRefresh(read: () => Promise<void>, onError: () => void) {
  let active = true;
  let pending = false;
  return {
    async refresh(): Promise<void> {
      if (!active || pending) return;
      pending = true;
      try {
        await read();
      } catch {
        if (active) onError();
      } finally {
        pending = false;
      }
    },
    close() { active = false; },
  };
}
