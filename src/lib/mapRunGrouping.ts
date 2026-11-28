/** Screen-space grouping is visual only: it never changes a race's
 * real longitude/latitude or replaces its original event ID. */
export type ProjectedRun = {
  index: number;
  x: number;
  y: number;
  isOwn: boolean;
  isDemo: boolean;
};
export type RunGroup = {
  anchor: number;
  members: number[];
  demoCount: number;
  realCount: number;
  hasOwn: boolean;
};

/** Groups icons that would overlap on a phone. Each member stays tied to its
 * original geographic position; only the anchor draws a count badge. */
export function groupOverlappingRuns(
  items: readonly ProjectedRun[], spacing = 42,
): RunGroup[] {
  if (!Number.isFinite(spacing) || spacing <= 0) return [];
  const groups: Array<{ origin: ProjectedRun; members: ProjectedRun[] }> = [];
  for (const item of items) {
    if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) continue;
    // Only group around the original projected anchor; this avoids long chains
    // combining races spread over entire streets or neighbourhoods.
    let match = groups.find(group =>
      Math.hypot(group.origin.x - item.x, group.origin.y - item.y) < spacing);
    if (!match) {
      match = { origin: item, members: [] };
      groups.push(match);
    }
    match.members.push(item);
  }
  return groups.map(group => {
    const preferred = group.members.find(item => item.isOwn) ?? group.origin;
    return {
      anchor: preferred.index,
      members: group.members.map(item => item.index),
      demoCount: group.members.filter(item => item.isDemo).length,
      realCount: group.members.filter(item => !item.isDemo).length,
      hasOwn: group.members.some(item => item.isOwn),
    };
  });
}
