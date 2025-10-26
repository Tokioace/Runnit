import React from 'react';
import { Card } from '../ui/Card';

export function ProfileHeader({ 
  username, 
  level, 
  progress 
}: { 
  username: string; 
  level: number; 
  progress: number; 
}) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center text-xl font-bold">
        {username[0]?.toUpperCase() || 'R'}
      </div>
      <div className="flex-1">
        <div className="text-base font-semibold text-text">{username}</div>
        <div className="text-xs text-muted mb-2">Level {level}</div>
        <div className="h-3 w-full rounded-full bg-white/10">
          <div 
            className="h-3 rounded-full bg-primary transition-all duration-300" 
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>
    </Card>
  );
}