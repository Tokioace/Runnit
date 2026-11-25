/** Per-subscription lifetime. Auth notifications supersede the initial
 * session snapshot even if the snapshot eventually resolves or rejects. */
export function createAuthSnapshotGuard() {
  let active = true;
  let revision = 0;
  return {
    capture: () => revision,
    isCurrent: (captured: number) => active && captured === revision,
    acceptEvent: () => {
      if (!active) return false;
      revision += 1;
      return true;
    },
    close: () => { active = false; },
  };
}
