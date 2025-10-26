import React from 'react';
import { Card } from '../ui/Card';

const tier = (rank: number) => rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';

export function LeaderboardRow({ 
  rank, 
  name, 
  time, 
  distance 
}: {
  rank: number; 
  name: string; 
  time: string; 
  distance: string;
}) {
  const t = tier(rank);
  
  return (
    <Card className={`flex items-center justify-between px-3 py-3 ${
      t === 'gold' 
        ? 'bg-[linear-gradient(90deg,rgba(201,162,39,.15),transparent)] border-gold/30' 
        : t === 'silver' 
        ? 'bg-[linear-gradient(90deg,rgba(156,163,175,.15),transparent)] border-silver/30' 
        : t === 'bronze' 
        ? 'bg-[linear-gradient(90deg,rgba(176,122,84,.15),transparent)] border-bronze/30' 
        : ''
    }`}>
      <div className="flex items-center gap-3">
        <div className="w-8 text-center text-sm font-semibold text-muted">
          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
        </div>
        <div className="text-sm font-medium text-text truncate max-w-[9rem]">
          {name}
        </div>
      </div>
      <div className="flex items-baseline gap-3">
        <div className="text-lg font-bold tracking-tight text-text tabular-nums">
          {time}
        </div>
        <div className="text-xs text-muted">
          {distance}
        </div>
      </div>
    </Card>
  );
}