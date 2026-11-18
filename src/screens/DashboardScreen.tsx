import { Link } from 'react-router-dom';
import { Activity, ArrowRight, ChevronRight, Flag, Settings, Swords, Timer, Trophy, UserRound } from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import { useRunnerHistory } from '../hooks/useRunnerHistory';
import { formatRaceTime } from '../lib/runnerHistory';

const modes = [
  { label: 'AKTIVITÄT', to: '/stats', Icon: Activity, lime: true },
  { label: 'RENNEN', to: '/map', Icon: Swords, lime: false },
  { label: 'RANGLISTE', to: '/leaderboard', Icon: Trophy, lime: false },
  { label: 'PROFIL', to: '/profile', Icon: UserRound, lime: false },
] as const;

type DashboardProps = { displayName?: string | null; userId?: string | null };

export default function DashboardScreen({ displayName, userId }: DashboardProps) {
  const { races, loading, error, refresh } = useRunnerHistory(userId);
  const last = races[0] ?? null;
  const nickname = displayName || 'GAST';
  const outcome = !last ? '' : !last.completed ? 'ZEIT GESPEICHERT · NICHT ABGESCHLOSSEN'
    : last.outcome === 'won' ? 'SIEG' : last.outcome === 'lost' ? 'NIEDERLAGE'
      : last.outcome === 'tie' ? 'UNENTSCHIEDEN' : 'DUELL ABGESCHLOSSEN';

  return (
    <main className="runnit-game-home runnit-dash-master relative min-h-[100dvh] w-full max-w-full overflow-x-clip text-white">
      <div className="runnit-game-content relative z-10 mx-auto w-full max-w-[680px] px-3 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-5">
        <header className="runnit-game-hero" aria-label="RUNNIT Arcade">
          <div className="runnit-hero-portrait" aria-hidden="true" /><div className="runnit-hero-glow" aria-hidden="true" />
          <div className="relative z-10 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="runnit-game-logo"><img src="/runnit-metal-logo.svg" alt="RUNNIT" width={840} height={174}/></div>
              <p className="runnit-game-motto">CHALLENGE. <em>RACE.</em> <strong>BEAT.</strong></p>
            </div>
            <Link className="runnit-game-settings" to="/profile" aria-label="Profil und Einstellungen"><Settings aria-hidden="true" /></Link>
          </div>
          <p className="relative z-10 mt-4 text-center text-xs font-black italic tracking-[0.3em] text-cyan-200/90">DEINE STADT. DEIN DUELL.</p>
        </header>

        <section className="runnit-game-hud" aria-label="Spieler">
          <div className="runnit-game-avatar"><UserRound aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <strong className="truncate text-[clamp(1.1rem,5.5vw,1.8rem)] font-black italic">{nickname}</strong>
              <Link to="/profile" aria-label="Profil bearbeiten" className="text-cyan-200"><ChevronRight aria-hidden="true" /></Link>
            </div>
            <p className="mt-1 text-[10px] font-black tracking-wide text-cyan-200">{userId ? 'RUNNER-KONTO VERBUNDEN' : 'GASTMODUS · FÜR DUELLE ANMELDEN'}</p>
          </div>
          <span className="runnit-game-emblem" aria-hidden="true">R✦</span>
        </section>

        <nav className="runnit-game-modes grid grid-cols-4 gap-1.5 sm:gap-3" aria-label="Hauptfunktionen">
          {modes.map(({ label, to, Icon, lime }) => (
            <Link key={label} to={to} className={lime ? 'runnit-game-mode is-lime' : 'runnit-game-mode'}>
              <Icon className="h-7 w-7 sm:h-9 sm:w-9" strokeWidth={2.5} aria-hidden="true"/><span>{label}</span>
            </Link>
          ))}
        </nav>

        <Link to="/map" className="runnit-game-duel mt-4" aria-label="Auf der Karte ein 1v1 Duell suchen">
          <div>
            <h2>1v1 <span>DUELL</span> <b aria-hidden="true">»</b></h2>
            <p>FORDERE JETZT JEMANDEN<br/>IN DEINER NÄHE HERAUS!</p>
          </div>
          <span className="runnit-duel-speedlines" aria-hidden="true" />
        </Link>

        <Link to="/ghost-run" className="mt-3 flex min-h-16 items-center justify-between gap-2 rounded-2xl border-2 border-cyan-300 bg-gradient-to-r from-[#133d6f] via-[#17275a] to-[#3b174f] px-4 py-3 shadow-[0_0_17px_rgba(46,224,255,.35)]" aria-label="Ghost Run alleine starten">
          <span className="flex flex-col gap-1">
            <strong className="text-xl font-black italic tracking-tight text-white">GHOST RUN <span className="text-lime-300">SOLO</span></strong>
            <small className="text-[10px] font-black tracking-wide text-cyan-200">TRAINING · GPS + SCHRITTZÄHLER</small>
          </span>
          <ArrowRight className="h-6 w-6 shrink-0 text-lime-300" aria-hidden="true" />
        </Link>

        <section className="runnit-game-panel mt-4 p-4" aria-labelledby="recent-race-title">
          <div className="flex items-center justify-between gap-2">
            <h2 id="recent-race-title"><Timer className="h-4 w-4" aria-hidden="true" /> LETZTER LAUF</h2>
            <Link to="/stats" className="text-[10px] font-black text-cyan-200">DEINE HISTORIE <ChevronRight className="inline h-4 w-4" /></Link>
          </div>
          {!userId ? (
            <p className="mt-3 text-xs leading-5 text-white/70">Melde dich an, damit deine gespeicherten Zeiten hier erscheinen.</p>
          ) : loading ? (
            <p role="status" className="mt-3 text-xs text-cyan-100">ERGEBNIS WIRD GELADEN …</p>
          ) : error ? (
            <div className="mt-3 text-xs"><p role="alert" className="text-amber-200">{error}</p>
              <button type="button" className="mt-2 font-black text-cyan-200" onClick={refresh}>NEU LADEN</button>
            </div>
          ) : last ? (
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-cyan-300/20 pt-3">
              <div>
                <p className="text-lg font-black italic text-white">1V1 · {last.distanceM} M</p>
                <p className="text-[10px] font-black text-lime-200">{outcome}</p>
                <p className="mt-1 text-[10px] text-white/60">{new Date(last.occurredAt).toLocaleDateString('de-DE')} · SERVERGESPEICHERT</p>
              </div>
              <strong className="shrink-0 text-xl font-black tabular-nums text-cyan-100">{formatRaceTime(last.timeMs)}</strong>
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-white/65">Noch kein gespeichertes Duell. Nach dem Zieleinlauf findest du hier dein letztes Ergebnis.</p>
          )}
        </section>

        <Link to="/map" className="runnit-game-start group" aria-label="Zur Karte und Rennen starten">
          <Flag aria-hidden="true" /><span>RENNEN ENTDECKEN</span><ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      <BottomNav />
    </main>
  );
}

