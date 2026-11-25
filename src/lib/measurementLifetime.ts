/** A permission dialog or network request cannot be canceled reliably.
 * Retire its continuation synchronously when the owning screen is removed. */
export function createMeasurementLifetime() {
  let generation = 0;
  let active = false;
  return {
    open() { generation += 1; active = true; },
    close() { generation += 1; active = false; },
    capture() {
      const captured = generation;
      return () => active && generation === captured;
    },
    isActive: () => active,
  };
}
export function measurementAccountCurrent(isLive: () => boolean, assertAccount: () => void): boolean {
  if (!isLive()) return false;
  try { assertAccount(); return true; } catch { return false; }
}
