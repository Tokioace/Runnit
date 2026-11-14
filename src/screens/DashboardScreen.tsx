import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, ArrowRight, BarChart3, ChevronRight, Crown, Flag, Flame, Footprints, Globe2, MapPin, Settings, ShieldCheck, Swords, Timer, Trophy, UserRound, Zap } from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';

// Layout order and art direction are taken from the approved 864x1536 design.
// XP, ranks, steps and races are NOT fabricated while these services are absent.
const modes = [
  { label: 'AKTIVITÄT', to: '/home#aktivitaet', Icon: Activity, lime: true },
  { label: 'RENNEN', to: '/map', Icon: Swords, lime: false },
  { label: 'RANGLISTE', to: '/leaderboard', Icon: Trophy, lime: false },
  { label: 'PROFIL', to: '/profile', Icon: UserRound, lime: false },
] as const;
const activity = [
  { label: 'SCHRITTE', Icon: Footprints, unit: '' },
  { label: 'DISTANZ', Icon: MapPin, unit: 'km' },
  { label: 'KALORIEN', Icon: Flame, unit: 'kcal' },
] as const;

type DashboardProps = { displayName?: string | null };

export default function DashboardScreen({ displayName }: DashboardProps) {
  const nickname = displayName || 'GAST';
  const location = useLocation();

  // The fifth dock tab is a real jump to the activity block, not a dead UI tile.
  useEffect(() => {
    if (location.hash !== '#aktivitaet') return;
    document.getElementById('aktivitaet')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [location.hash]);
  return (
    <main className="runnit-game-home relative min-h-[100dvh] w-full max-w-full overflow-x-clip text-white">
      <div className="runnit-game-content relative z-10 mx-auto w-full max-w-[680px] px-3 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-5">
        <header className="runnit-game-hero" aria-label="RUNNIT Arcade">
          <div className="relative z-10 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="runnit-game-logo">RUNNIT<span aria-hidden="true">▦</span></div>
              <p className="runnit-game-motto">CHALLENGE. <em>RACE.</em> <strong>BEAT.</strong></p>
            </div>
            <Link className="runnit-game-settings" to="/profile" aria-label="Profil und Einstellungen"><Settings aria-hidden="true" /></Link>
          </div>
          <p className="relative z-10 mt-6 text-[9px] font-black italic tracking-widest text-cyan-200">DEIN LAUF. DEINE STADT. DEINE CHALLENGE.</p>
          <div className="runnit-game-ranks relative z-10 mt-3 grid grid-cols-3 gap-2" aria-label="Noch keine offiziellen Platzierungen">
            <span><MapPin aria-hidden="true" /> STADT <b>—</b></span>
            <span><Flag aria-hidden="true" /> LAND <b>—</b></span>
            <span><Globe2 aria-hidden="true" /> WELT <b>—</b></span>
          </div>
        </header>

        <section className="runnit-game-hud" aria-label="Spielerstatus">
          <div className="runnit-game-avatar"><UserRound aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <strong className="truncate text-[clamp(1.1rem,5.5vw,1.8rem)] font-black italic">{nickname}</strong>
              <Link to="/profile" aria-label="Profil bearbeiten" className="text-cyan-200"><ChevronRight aria-hidden="true" /></Link>
            </div>
            <div className="flex items-end justify-between gap-2 text-[10px] font-black italic"><span className="text-cyan-200">LEVEL —</span><span className="text-white/65">XP NOCH NICHT VERFÜGBAR</span></div>
            <div className="runnit-game-xp" role="img" aria-label="XP-System noch nicht verfügbar" />
          </div>
          <span className="runnit-game-emblem" aria-hidden="true">R✦</span>
        </section>

        <nav className="runnit-game-modes grid grid-cols-4 gap-1.5 sm:gap-3" aria-label="Hauptfunktionen">
          {modes.map(({ label, to, Icon, lime }) => (
            <Link key={label} to={to} className={lime ? 'runnit-game-mode is-lime' : 'runnit-game-mode'}>
              <Icon className="h-7 w-7 sm:h-9 sm:w-9" strokeWidth={2.5} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <section className="runnit-game-panel runnit-game-activity" id="aktivitaet" aria-labelledby="activity-title">
          <div className="flex items-center justify-between gap-2">
            <h1 id="activity-title">AKTIVITÄT <span aria-hidden="true">////</span></h1>
            <span className="text-[9px] font-black italic whitespace-nowrap">DIESE WOCHE ⌄</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-3">
            {activity.map(({ label, Icon, unit }) => (
              <div className="runnit-game-stat" key={label}>
                <Icon className="h-6 w-6 sm:h-8 sm:w-8" aria-hidden="true" />
                <p className="text-[clamp(9px,2.5vw,14px)] font-black italic">{label}</p>
                <p className="runnit-game-stat-value">— <small>{unit}</small></p>
                <p className="text-[9px] font-bold text-lime-300">NICHT VERBUNDEN</p>
              </div>
            ))}
          </div>
        </section>

        <Link to="/map" className="runnit-game-duel" aria-label="Auf der Karte ein 1v1 Duell suchen">
          <div>
            <h2>1v1 <span>DUELL</span> <b aria-hidden="true">»</b></h2>
            <p>FORDERE JETZT JEMANDEN<br />IN DEINER NÄHE HERAUS!</p>
          </div>
          <Swords className="h-14 w-14 shrink-0 text-cyan-200" aria-hidden="true" />
        </Link>

        <div className="runnit-game-lower mt-4 grid grid-cols-2 gap-2.5">
          <section className="runnit-game-panel" aria-labelledby="recent-races-title">
            <h2 id="recent-races-title"><Timer className="h-4 w-4" aria-hidden="true" /> LETZTE RENNEN</h2>
            <div className="runnit-game-empty"><Flag aria-hidden="true" /><span>NOCH KEINE<br /><small>verifizierten Rennen</small></span></div>
            <Link to="/map" className="runnit-game-small-action">RENNEN ANSEHEN <ChevronRight aria-hidden="true" /></Link>
          </section>
          <section className="runnit-game-panel" aria-labelledby="ranking-title">
            <h2 id="ranking-title"><Crown className="h-4 w-4 text-lime-300" aria-hidden="true" /> RANGLISTE</h2>
            <div className="runnit-game-empty"><Trophy aria-hidden="true" /><span>NOCH KEINE<br /><small>offiziellen Plätze</small></span></div>
            <Link to="/leaderboard" className="runnit-game-small-action">GESAMTE RANGLISTE <ChevronRight aria-hidden="true" /></Link>
          </section>
        </div>

        <Link to="/map" className="runnit-game-start group"><Zap aria-hidden="true" /><span>RENNEN STARTEN</span><ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></Link>
        <p className="mt-7 flex items-start gap-2 text-[10px] leading-5 text-cyan-100/65"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />XP, Rangplätze und Wochenwerte sind noch nicht mit verlässlichen Datenquellen verbunden. Die Anzeige enthält keine erfundenen Ergebnisse.</p>
        <Link to="/gps-lab" className="mt-3 flex min-h-10 items-center justify-center gap-1 text-xs font-black tracking-widest text-cyan-300 underline underline-offset-4">GPS-TESTLABOR <ChevronRight className="h-4 w-4" /></Link>
      </div>
      <BottomNav />
    </main>
  );
}
