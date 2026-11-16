import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Flag, Home, Map, MapPin, Trophy, User } from 'lucide-react';

const tabs = [
  { href: '/home', label: 'Start', display: 'HOME', icon: Home },
  { href: '/map', label: 'Karte', display: 'KARTE', icon: Map },
  { href: '/stats', label: 'Stats', display: 'STATS', icon: BarChart3 },
  { href: '/leaderboard', label: 'Rangliste', display: 'RANGLISTE', icon: Trophy },
  { href: '/profile', label: 'Profil', display: 'PROFIL', icon: User },
];

// The four-slot arcade dock exists only on the ranking screen; the regular
// five-route app navigation remains unchanged elsewhere.
const rankingTabs = [
  { href: '/home', label: 'Home', display: 'HOME', icon: Home },
  { href: '/map', label: 'Karte', display: 'KARTE', icon: MapPin },
  { href: '/map?view=list', label: 'Rennen', display: 'RENNEN', icon: Flag },
  { href: '/leaderboard', label: 'Rangliste', display: 'RANGLISTE', icon: Trophy },
];

export default function BottomNav({ variant = 'default' }: { variant?: 'default' | 'ranking' }) {
  const location = useLocation();
  const ranking = variant === 'ranking';
  const visibleTabs = ranking ? rankingTabs : tabs;
  return (
    <nav aria-label="Hauptnavigation" className={'runnit-game-dock fixed inset-x-0 bottom-0 z-[950] w-full max-w-full overflow-hidden border-t border-cyan-300/40 bg-[#090f30]/95 shadow-[0_-10px_35px_rgba(0,0,0,.45)] backdrop-blur-md' + (ranking ? ' runnit-ranking-dock' : '')}>
      <ul className={'mx-auto grid w-full max-w-lg gap-0.5 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 ' + (ranking ? 'grid-cols-4' : 'grid-cols-5')}>
        {visibleTabs.map(({ href, label, display, icon: Icon }) => {
          const active = location.pathname === href.split('?')[0] && (!ranking || href === '/leaderboard');
          return (
            <li key={display} className="min-w-0">
              <Link to={href} aria-label={label} aria-current={active ? 'page' : undefined}
                className={'runnit-dock-item flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[9px] font-black italic transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ' + (active ? 'runnit-dock-active text-cyan-100' : 'text-white/80 hover:bg-white/10 hover:text-white')}>
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="runnit-dock-caption block w-full text-center">{display}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
