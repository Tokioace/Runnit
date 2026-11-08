import { Card } from '../ui/Card';
import {
  leaderboardSourceLabel,
  type LeaderboardSource,
} from '../../lib/leaderboardProvenance';

export function LeaderboardRow({
  rank,
  name,
  time,
  distance,
  source,
}: {
  rank: number;
  name: string;
  time: string;
  distance: string;
  source: LeaderboardSource;
}) {
  const isDemo = source === 'demo';

  return (
    <Card className="flex items-center justify-between gap-3 border-white/10 px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="w-9 shrink-0 text-center text-sm font-semibold text-muted">
          #{rank}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text">{name}</div>
          <div className={`mt-1 text-[11px] font-medium ${isDemo ? 'text-amber-300' : 'text-cyan-300'}`}>
            {leaderboardSourceLabel(source)}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="text-lg font-bold tracking-tight text-text tabular-nums">
          {time}
        </div>
        <div className="text-xs text-muted">{distance}</div>
      </div>
    </Card>
  );
}
