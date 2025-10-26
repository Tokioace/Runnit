import React from 'react';
import { Card } from '../ui/Card';

export function StatCard({ 
  label, 
  value, 
  className 
}: { 
  label: string; 
  value: string; 
  className?: string; 
}) {
  return (
    <Card className={`p-4 ${className || ''}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-bold tabular-nums text-text">{value}</div>
    </Card>
  );
}