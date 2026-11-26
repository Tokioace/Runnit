/** One in-flight finish read per mounted result screen.
 * Polling drops overlapping requests; explicit recovery may queue one
 * follow-up. Retirement cancels the queue and ignores late errors. */
export function createFinishRefresh(read: () => Promise<void>, onError: () => void) {
  let active = true;
  let pending = false;
  let followUp = false;
  return {
    async refresh(queueIfBusy = false): Promise<void> {
      if (!active) return;
      if (pending) {
        if (queueIfBusy) followUp = true;
        return;
      }
      pending = true;
      try {
        do {
          followUp = false;
          try {
            await read();
          } catch {
            if (active) onError();
          }
        } while (active && followUp);
      } finally {
        pending = false;
      }
    },
    close() { active = false; followUp = false; },
  };
}
