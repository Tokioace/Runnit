/** A visible goal is derived from real completed wins; it is not a stored or simulated score. */
export function nextWinMilestone(wins: number): { start: number; target: number; percent: number } {
  const safe = Number.isFinite(wins) ? Math.max(0, Math.floor(wins)) : 0;
  const milestones = [5, 10, 25, 50, 100];
  const target = milestones.find(value => safe < value) ?? (Math.floor(safe / 100) + 1) * 100;
  const start = milestones.filter(value => value <= safe).at(-1) ?? 0;
  return { start, target, percent: Math.max(0, Math.min(100, ((safe - start) / (target - start)) * 100)) };
}
