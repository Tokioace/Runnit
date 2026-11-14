import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Home, Map, Trophy, User } from 'lucide-react';

const tabs = [
  { href: '/home', label: 'Start', display: 'HOME', icon: Home },
  { href: '/map', label: 'Karte', display: 'KARTE', icon: Map },
  { href: '/home#aktivitaet', label: 'Stats', display: 'STATS', icon: BarChart3 },
  { href: '/leaderboard', label: 'Rangliste', display: 'RANGLISTE', icon: Trophy },
  { href: '/profile', label: 'Profil', display: 'PROFIL', icon: User },
];

export default function BottomNav() {
  const location = useLocation();
  return (
    <nav aria-label="Hauptnavigation" className="runnit-game-dock fixed inset-x-0 bottom-0 z-[950] w-full max-w-full overflow-hidden border-t border-cyan-300/40 bg-[#090f30]/95 shadow-[0_-10px_35px_rgba(0,0,0,.45)] backdrop-blur-md">
      <ul className="mx-auto grid w-full max-w-lg grid-cols-5 gap-0.5 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {tabs.map(({ href, label, display, icon: Icon }) => {
          const active = href === '/home#aktivitaet'
            ? location.pathname === '/home' && location.hash === '#aktivitaet'
            : location.pathname === href && !(href === '/home' && location.hash === '#aktivitaet');
          return (
            <li key={href} className="min-w-0">
              <Link to={href} aria-label={label} aria-current={active ? 'page' : undefined}
                className={'runnit-dock-item flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[9px] font-black italic transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ' + (active ? 'runnit-dock-active text-cyan-100' : 'text-white/80 hover:bg-white/10 hover:text-white')}>
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="block max-w-full truncate">{display}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
