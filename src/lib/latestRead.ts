/** A newer read supersedes older reads, even if the newer read fails.
 * A retired screen or a failed read must not replace the last good snapshot. */
export function createLatestRead<T>() {
  let revision = 0;
  return {
    async run(isLive: () => boolean, read: () => Promise<T | null>, apply: (data: T) => void): Promise<void> {
      if (!isLive()) return;
      const current = ++revision;
      let result: T | null;
      try { result = await read(); } catch { return; }
      if (result !== null && current === revision && isLive()) apply(result);
    },
  };
}
