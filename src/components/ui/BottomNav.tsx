'use client';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Map, Trophy, User } from 'lucide-react';

const tabs = [
  { href: '/', label: 'Map', icon: Map },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/75 border-t border-white/5">
      <ul className="mx-auto grid max-w-lg grid-cols-3 gap-1 p-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = location.pathname === href;
          return (
            <li key={href}>
              <Link 
                to={href} 
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm transition will-change-transform ${
                  active 
                    ? 'text-text bg-primary/15 shadow-soft' 
                    : 'text-muted hover:text-text hover:bg-white/5'
                }`} 
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted'}`} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}