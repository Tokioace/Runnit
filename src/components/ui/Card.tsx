import { cn } from '../../lib/utils';
import React from 'react';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        'rounded-2xl bg-surface border border-white/5 shadow-soft', 
        className
      )} 
      {...props} 
    />
  );
}