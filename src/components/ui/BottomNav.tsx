import { Link, useLocation } from 'react-router-dom';
import { Home, Map, Trophy, User } from 'lucide-react';

const tabs = [
  { href: '/home', label: 'Start', icon: Home },
  { href: '/map', label: 'Karte', icon: Map },
  { href: '/leaderboard', label: 'Rangliste', icon: Trophy },
  { href: '/profile', label: 'Profil', icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  return (
    <nav aria-label="Hauptnavigation" className="fixed inset-x-0 bottom-0 z-[950] border-t border-white/10 bg-[#11131e]/95 shadow-[0_-10px_35px_rgba(0,0,0,.28)] backdrop-blur-md">
      <ul className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = location.pathname === href;
          return (
            <li key={href} className="min-w-0">
              <Link
                to={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-[11px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  active ? 'bg-violet-500/20 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-violet-300' : 'text-white/60'}`} aria-hidden="true" />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
