import { cn } from '../../lib/utils';
import React from 'react';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        'rounded-2xl border border-white/10 bg-[#121624] shadow-[0_12px_32px_rgba(0,0,0,.18)]', 
        className
      )} 
      {...props} 
    />
  );
}