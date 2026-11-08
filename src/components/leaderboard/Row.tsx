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
    <Card className="group flex min-h-[76px] items-center justify-between gap-3 border-white/10 bg-gradient-to-r from-violet-400/[0.075] to-white/[0.025] px-4 py-3 transition-colors hover:border-violet-300/20">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-300/10 text-sm font-black tabular-nums text-violet-200">
          {String(rank).padStart(2, '0')}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{name}</p>
          <p className={`mt-1 text-[10px] font-semibold tracking-wide ${isDemo ? 'text-amber-200/85' : 'text-cyan-200'}`}>
            {leaderboardSourceLabel(source)}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-lg font-black tracking-tight tabular-nums text-white">{time}</p>
        <p className="mt-0.5 text-[11px] font-medium text-white/45">{distance}</p>
      </div>
    </Card>
  );
}
