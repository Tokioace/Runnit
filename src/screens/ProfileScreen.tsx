import React from 'react';
import { Card } from '../components/ui/Card';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { StatCard } from '../components/profile/StatCard';
import BottomNav from '../components/ui/BottomNav';

export default function ProfileScreen() {
  return (
    <div className="min-h-screen bg-bg pb-24">
      <main className="p-4 space-y-4">
        <div className="text-center py-6">
          <h1 className="text-2xl font-bold text-text mb-2">Profile</h1>
          <p className="text-muted text-sm">Your running achievements and stats</p>
        </div>

        {/* Profile Header */}
        <ProfileHeader 
          username="Runner8" 
          level={12} 
          progress={65} 
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard 
            label="Best 100m" 
            value="9.33s" 
          />
          <StatCard 
            label="City Rank" 
            value="#12" 
          />
          <StatCard 
            label="Total Races" 
            value="47" 
          />
          <StatCard 
            label="Win Rate" 
            value="68%" 
          />
        </div>

        {/* Medals */}
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3 text-text">Recent Medals</div>
          <div className="flex gap-3 text-2xl">
            🥇🥈🥉🏅🎖️
          </div>
          <div className="mt-2 text-xs text-muted">
            5 medals earned this month
          </div>
        </Card>

        {/* Performance Chart Placeholder */}
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3 text-text">Performance Trend</div>
          <div className="h-24 bg-white/5 rounded-xl flex items-center justify-center">
            <svg width="200" height="60" className="text-primary">
              <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                points="10,50 50,30 90,35 130,20 170,25 190,15"
              />
            </svg>
          </div>
          <div className="mt-2 text-xs text-muted">
            Average time improving by 0.3s per week
          </div>
        </Card>
      </main>
      
      <BottomNav />
    </div>
  );
}