import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Flag, Footprints, Gauge, MapPin, RefreshCw, ShieldCheck, Timer, Trophy } from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import { useRunnerHistory } from '../hooks/useRunnerHistory';
import { formatRaceTime } from '../lib/runnerHistory';

type Props = { userId?: string | null };
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-cyan-300/20 bg-[#081c39]/80 p-3">
      <p className="text-[10px] font-black tracking-wide text-cyan-200">{label}</p>
      <strong className="mt-1 block text-[clamp(1.1rem,5vw,1.7rem)] font-black text-white">{value}</strong>
      <small className="text-[10px] leading-4 text-white/55">{note}</small>
    </div>
  );
}

export default function StatsScreen({ userId }: Props) {
  const { races, ghostSessions, totals, loading, error, refresh } = useRunnerHistory(userId);
  const entries = [
    ...races.map(r => ({
      id: 'd-' + r.id, timestamp: r.occurredAt, title: '1V1 · ' + r.distanceM + ' M',
      sub: r.completed
        ? r.outcome === 'won' ? 'DUELL GEWONNEN' : r.outcome === 'lost' ? 'DUELL VERLOREN'
          : r.outcome === 'tie' ? 'UNENTSCHIEDEN' : 'ERGEBNIS GESPEICHERT'
        : 'ZEIT GESPEICHERT · DUELL NICHT ABGESCHLOSSEN',
      time: formatRaceTime(r.timeMs), completed: r.completed,
    })),
    ...ghostSessions.map(g => ({
      id: 'g-' + g.id, timestamp: g.created_at, title: 'GHOST · ' + g.target_distance_m + ' M',
      sub: g.run_state === 'finished' ? 'TRAINING ABGESCHLOSSEN · NICHT GEWERTET'
        : 'TRAINING ABGEBROCHEN · NICHT GEWERTET',
      time: formatRaceTime(g.elapsed_ms), completed: g.run_state === 'finished',
    })),
  ].sort((a,b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0,16);

  return (
    <main className="runnit-game-home runnit-stats-screen relative min-h-[100dvh] w-full max-w-full overflow-x-clip text-white">
      <div className="runnit-game-content relative z-10 mx-auto w-full max-w-[680px] space-y-4 px-3 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-5">
        <header className="runnit-stats-hero">
          <div className="flex items-center justify-between gap-2">
            <Link to="/home" aria-label="Zur Startseite" className="runnit-stats-back"><ArrowLeft className="h-6 w-6" /></Link>
            <strong className="font-black italic tracking-[0.2em] text-cyan-100">RUNNIT</strong>
            <span className="runnit-stats-beta">MEINE DATEN</span>
          </div>
          <div className="mt-7">
            <p className="runnit-stats-kicker">DEIN PROTOKOLL · SERVERGESPEICHERT</p>
            <h1>DEINE <span>STATS.</span></h1>
            <p className="mt-2 max-w-sm text-xs leading-5 text-cyan-100/80">
              Nur abgeschlossene Duelle und gespeicherte Ghost-Trainings. Keine Demo-Punkte oder erfundenen Kalorien.
            </p>
          </div>
        </header>

        {!userId ? (
          <section className="runnit-game-panel space-y-3 p-5" role="status">
            <h2 className="text-lg font-black italic">DEIN VERLAUF IST PRIVAT</h2>
            <p className="text-sm text-white/75">Melde dich an, um deine gespeicherten Ergebnisse, Schritte und Bestzeiten zu sehen.</p>
            <Link to="/login?next=%2Fstats" className="runnit-stats-action">ANMELDEN <ArrowRight className="h-5 w-5" /></Link>
          </section>
        ) : (
          <>
            {error && <div role="alert" className="runnit-game-panel space-y-2 border-amber-400/50 p-4">
              <p className="text-sm text-amber-100">{error}</p>
              <button type="button" onClick={refresh} className="text-sm font-bold text-cyan-200"><RefreshCw className="mr-1 inline h-4 w-4"/>ERNEUT LADEN</button>
            </div>}
            {loading ? <p role="status" className="runnit-game-panel p-5 text-sm text-cyan-100">GESPEICHERTE ERGEBNISSE WERDEN GELADEN …</p> : !error && (
              <>
                <section className="runnit-game-panel p-4" aria-labelledby="weekly-title">
                  <div className="flex items-center justify-between gap-2">
                    <h2 id="weekly-title" className="runnit-stats-heading">DIESE <span>WOCHE</span></h2>
                    <span className="runnit-stats-period">NUR RUNNIT-LÄUFE</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Metric label="LÄUFE" value={String(totals.weeklySessions)} note="abgeschlossen" />
                    <Metric label="SCHRITTE" value={totals.weeklySteps === null ? '—' : totals.weeklySteps.toLocaleString('de-DE')} note="aufgezeichnet" />
                    <Metric label="STRECKE" value={totals.weeklyDistanceM === null ? '—' : (totals.weeklyDistanceM/1000).toFixed(2).replace('.',',')+' km'} note="aus Läufen" />
                  </div>
                </section>

                <section className="runnit-game-panel p-4" aria-labelledby="duel-title">
                  <div className="flex items-center justify-between gap-2">
                    <h2 id="duel-title" className="runnit-stats-heading">DUELL-<span>BILANZ</span></h2>
                    <Trophy className="h-5 w-5 text-lime-300" aria-hidden="true" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Metric label="DUELLE" value={String(totals.completedDuels)} note="mit 2 Ergebnissen" />
                    <Metric label="SIEGE" value={String(totals.wins)} note="gespeicherte Zeiten" />
                    <Metric label="NIEDERLAGEN" value={String(totals.losses)} note={'Remis: '+totals.ties} />
                  </div>
                  <h3 className="mb-2 mt-5 text-xs font-black tracking-widest text-cyan-200">BESTZEITEN AUS ABGESCHLOSSENEN DUELLEN</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Metric label="50 M" value={formatRaceTime(totals.best50Ms)} note="persönlich" />
                    <Metric label="75 M" value={formatRaceTime(totals.best75Ms)} note="persönlich" />
                    <Metric label="100 M" value={formatRaceTime(totals.best100Ms)} note="persönlich" />
                  </div>
                  <Link to="/leaderboard" className="runnit-stats-action mt-4"><Trophy className="h-5 w-5"/> ZUR BETA-RANGLISTE <ArrowRight className="h-5 w-5"/></Link>
                </section>

                <section className="runnit-game-panel p-4" aria-labelledby="history-title">
                  <div className="flex items-center justify-between gap-2">
                    <h2 id="history-title" className="runnit-stats-heading">LAUF-<span>HISTORIE</span></h2>
                    <span className="runnit-stats-period">{entries.length} EINTRÄGE</span>
                  </div>
                  {entries.length === 0 ? (
                    <div role="status" className="py-5 text-sm leading-6 text-white/65">Noch keine gespeicherten Läufe. Nach einem erfolgreich beendeten Duell erscheint hier dein echtes Ergebnis.</div>
                  ) : (
                    <ol className="mt-3 divide-y divide-cyan-300/15">
                      {entries.map(e => <li key={e.id} className="flex min-h-16 items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <strong className="block text-sm font-black italic">{e.title}</strong>
                          <p className="mt-1 text-[10px] font-bold tracking-wide text-cyan-200">{e.sub}</p>
                          <p className="text-[10px] text-white/50">{Number.isFinite(Date.parse(e.timestamp)) ? new Date(e.timestamp).toLocaleDateString('de-DE') : ''}</p>
                        </div>
                        <span className="shrink-0 text-base font-black tabular-nums text-lime-200">{e.time}</span>
                      </li>)}
                    </ol>
                  )}
                </section>

                <p className="flex gap-2 text-[11px] leading-5 text-cyan-100/70">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
                  Duelle sind beidseitig gespeicherte Beta-Ergebnisse. Die GPS-/IMU-Messung ist noch nicht unabhängig auf Manipulation geprüft. Ghost-Trainings zählen nicht als Wettkämpfe.
                </p>
              </>
            )}
          </>
        )}

        <Link to="/map" className="runnit-game-start group" aria-label="Zur Karte und Rennen">
          <Flag aria-hidden="true" /><span>ZUM NÄCHSTEN RENNEN</span><ArrowRight aria-hidden="true"/>
        </Link>
      </div>
      <BottomNav />
    </main>
  );
}

