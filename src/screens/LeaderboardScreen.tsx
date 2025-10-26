import React, { useState } from 'react';
import { LeaderboardRow } from '../components/leaderboard/Row';
import BottomNav from '../components/ui/BottomNav';

// Mock data for demonstration
const mockEntries = [
  { rank: 1, name: 'SpeedRunner23', time: '8.92s', distance: '100m' },
  { rank: 2, name: 'FlashFeet', time: '9.33s', distance: '100m' },
  { rank: 3, name: 'RocketRunner', time: '9.45s', distance: '100m' },
  { rank: 4, name: 'TurboTom', time: '9.67s', distance: '100m' },
  { rank: 5, name: 'LightningLisa', time: '9.89s', distance: '100m' },
];

export default function LeaderboardScreen() {
  const [activeTab, setActiveTab] = useState<'city' | 'national' | 'global'>('city');

  const tabs = [
    { key: 'city' as const, label: 'City', emoji: '🏙️' },
    { key: 'national' as const, label: 'National', emoji: '🇩🇪' },
    { key: 'global' as const, label: 'Global', emoji: '🌍' },
  ];

  return (
    <div className="min-h-screen bg-bg pb-24">
      <main className="p-4 space-y-4">
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold text-text mb-2">Leaderboards</h1>
          <p className="text-muted text-sm">Top runners in your area and beyond</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 rounded-2xl bg-white/5 p-1">
          {tabs.map(({ key, label, emoji }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-primary text-white shadow-soft'
                  : 'text-muted hover:text-text hover:bg-white/10'
              }`}
            >
              <span className="mr-2">{emoji}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Leaderboard Content */}
        <div className="space-y-2">
          {mockEntries.map(entry => (
            <LeaderboardRow key={entry.rank} {...entry} />
          ))}
        </div>

        {/* Load More */}
        <div className="text-center pt-4">
          <button className="text-primary text-sm font-medium hover:text-primary-600 transition-colors">
            Load more runners
          </button>
        </div>
      </main>
      
      <BottomNav />
    </div>
  );
}