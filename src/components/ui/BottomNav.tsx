import { Link, useLocation } from 'react-router-dom';
import { MapPin, Play, Trophy } from 'lucide-react';
import '../../styles/arenaArcade.css';

/** RUNNIT's three main destinations, matching the approved Arena references.
 * The profile remains available from the header avatar. */
const tabs = [
  { href: '/home', label: 'PLAY', icon: Play },
  { href: '/map', label: 'MAP', icon: MapPin },
  { href: '/leaderboard', label: 'ARENA', icon: Trophy },
] as const;

export default function BottomNav() {
  const location = useLocation();
  return (
    <nav aria-label="Hauptnavigation" className="arena-global-dock">
      <ul>
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = location.pathname === href;
          return (
            <li key={href}>
              <Link to={href} aria-label={label} aria-current={active ? 'page' : undefined}>
                <Icon aria-hidden="true"/>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
