import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Trophy } from 'lucide-react';
import { LeaderboardRow } from './Row';

export function LeaderboardSheet({ 
  city, 
  entries 
}: { 
  city: string; 
  entries: Array<{
    rank: number; 
    name: string; 
    time: string; 
    distance: string;
  }> 
}) {
  const [activeTab, setActiveTab] = useState<'city' | 'national' | 'global'>('city');

  const tabs = [
    { key: 'city' as const, label: 'City', active: activeTab === 'city' },
    { key: 'national' as const, label: 'National', active: activeTab === 'national' },
    { key: 'global' as const, label: 'Global', active: activeTab === 'global' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Trophy className="h-5 w-5 text-primary" /> 
        {city}
      </div>
      
      <div className="flex gap-2">
        {tabs.map(({ key, label, active }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              active 
                ? 'bg-primary text-white' 
                : 'bg-white/5 text-muted hover:text-text hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      
      <div className="space-y-2">
        {entries.map(e => (
          <LeaderboardRow key={e.rank} {...e} />
        ))}
      </div>
    </div>
  );
}