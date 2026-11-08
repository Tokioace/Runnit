/**
 * Provenance of leaderboard display entries.
 *
 * No value in this union means "officially verified": our backend has not yet
 * established a reviewed, server-enforced verification protocol for GPS races.
 * Receiving a result from Supabase must never upgrade its trust level.
 */
export type LeaderboardSource = 'demo' | 'server-unverified' | 'local-unverified';

export type SourcedLeaderboardEntry = Readonly<{ source: LeaderboardSource }>;

export const SOURCE_LABELS: Readonly<Record<LeaderboardSource, string>> = {
  demo: 'Demo · erfunden',
  'server-unverified': 'Gespeichert · ungeprüft',
  'local-unverified': 'Lokal · ungeprüft',
};

export function leaderboardSourceLabel(source: LeaderboardSource): string {
  return SOURCE_LABELS[source];
}

/**
 * Keep example data separate from stored and local times.
 * Original order is preserved inside each group. The groups are not
 * official rankings and must not be combined into a medal table.
 */
export function partitionLeaderboard<T extends SourcedLeaderboardEntry>(entries: readonly T[]): {
  stored: T[];
  local: T[];
  demo: T[];
} {
  return {
    stored: entries.filter(entry => entry.source === 'server-unverified'),
    local: entries.filter(entry => entry.source === 'local-unverified'),
    demo: entries.filter(entry => entry.source === 'demo'),
  };
}
