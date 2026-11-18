import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Flag, Play, RefreshCw, Swords, Target, Timer, Trophy, UserRound, X, Zap } from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import { useRunnerHistory } from '../hooks/useRunnerHistory';
import { formatRaceTime } from '../lib/runnerHistory';
import { nextWinMilestone } from '../lib/homeMilestones';
import '../styles/homeShowcase.css';

type DashboardProps = { displayName?: string | null; userId?: string | null };

const RECORD_DISTANCES = [50, 75, 100] as const;
const formatDate = (date: string) => {
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleDateString('de-DE') : '—';
};

export default function DashboardScreen({ displayName, userId }: DashboardProps) {
  const { races, totals, loading, error, refresh } = useRunnerHistory(userId);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const name = displayName?.trim() || (userId ? 'RUNNER' : 'GAST');
  const ready = Boolean(userId) && !loading && !error;
  const completed = races.find(race => race.completed) ?? null;
  const pendingCount = races.filter(race => !race.completed).length;
  const wins = ready ? totals.wins : null;
  const duels = ready ? totals.completedDuels : null;
  const milestone = nextWinMilestone(totals.wins);
  const bestTimes = {
    50: ready ? totals.best50Ms : null,
    75: ready ? totals.best75Ms : null,
    100: ready ? totals.best100Ms : null,
  };
  const outcome = completed?.outcome === 'won' ? 'SIEG'
    : completed?.outcome === 'lost' ? 'NIEDERLAGE'
      : completed?.outcome === 'tie' ? 'REMIS' : 'ABGESCHLOSSEN';

  return (
    <main className="runnit-game-home runnit-showcase-home min-h-[100dvh] w-full overflow-x-clip text-white">
      <div className="runnit-showcase-stage">
        <header className="runnit-showcase-hero" aria-label="RUNNIT Home">
          <div className="runnit-showcase-art" aria-hidden="true" />
          <div className="runnit-showcase-top">
            <div className="runnit-showcase-brand">
              <img src="/runnit-metal-logo.svg" alt="RUNNIT" width={840} height={174} />
              <p>CHALLENGE. <em>RACE.</em> <strong>BEAT.</strong></p>
            </div>
            <button type="button" className="runnit-showcase-bell"
              aria-label="Meldungen anzeigen" aria-expanded={messagesOpen}
              aria-controls="runnit-showcase-messages" onClick={() => setMessagesOpen(open => !open)}>
              <Bell aria-hidden="true" />
              {ready && pendingCount > 0 && <span className="runnit-showcase-alert" aria-hidden="true" />}
            </button>
          </div>
          <div className="runnit-showcase-greeting">
            <p>Hallo</p>
            <h1 title={name}>{name}</h1>
            <span className="runnit-showcase-lime-line" aria-hidden="true" />
            <p className="runnit-showcase-challenge">BEREIT FÜR DAS<br />NÄCHSTE DUELL?</p>
          </div>
          {messagesOpen && (
            <div className="runnit-showcase-messages" id="runnit-showcase-messages" role="region" aria-label="Meldungen">
              <div className="runnit-showcase-messages-title"><strong>DEINE MELDUNGEN</strong>
                <button type="button" onClick={() => setMessagesOpen(false)} aria-label="Meldungen schließen"><X size={16} /></button>
              </div>
              {!userId ? <p>Melde dich an, um deine gespeicherten Duelle zu sehen.</p>
                : loading ? <p>Ergebnisse werden geladen …</p>
                  : error ? <p>Ergebnisse derzeit nicht verfügbar.</p>
                    : pendingCount > 0 ? <p>{pendingCount} Duell{pendingCount === 1 ? '' : 'e'} noch nicht abgeschlossen.</p>
                      : completed ? <p>Letztes Duell vom {formatDate(completed.occurredAt)}: {outcome.toLowerCase()}.</p>
                        : <p>Noch keine gespeicherten Duelle.</p>}
              <small>Keine Push-Benachrichtigungen aktiviert.</small>
            </div>
          )}
        </header>

        <section className="runnit-showcase-scoreboard" aria-label="Deine gespeicherte Duellbilanz" aria-busy={loading}>
          <div><Trophy aria-hidden="true" /><span><strong>{wins ?? (loading && userId ? '…' : '—')}</strong><small>{wins === 1 ? 'SIEG' : 'SIEGE'}</small></span></div>
          <div><Swords aria-hidden="true" /><span><strong>{duels ?? (loading && userId ? '…' : '—')}</strong><small>{duels === 1 ? 'DUELL' : 'DUELLE'}</small></span></div>
          <div><Timer aria-hidden="true" /><span><strong>{formatRaceTime(bestTimes[50])}</strong><small>BESTZEIT · 50 M</small></span></div>
        </section>

        <Link to="/map" className="runnit-showcase-cta" aria-label="Zur Karte, um ein Duell zu starten oder einem Duell beizutreten">
          <Play aria-hidden="true" fill="none" /><strong>DUELL STARTEN</strong><span aria-hidden="true">»</span>
        </Link>
        <Link to="/ghost-run" className="runnit-showcase-solo" aria-label="Alleine einen Ghost Run trainieren">GHOST RUN SOLO <span aria-hidden="true">›</span></Link>

        <section className="runnit-showcase-recent" aria-labelledby="recent-race-title">
          <div className="runnit-showcase-section-head">
            <h2 id="recent-race-title"><Flag aria-hidden="true" /> LETZTES DUELL</h2>
            {completed && <time dateTime={completed.occurredAt}>{formatDate(completed.occurredAt)}</time>}
          </div>
          {!userId ? <p className="runnit-showcase-placeholder">Melde dich an, um deine Ergebnisse zu sehen.</p>
            : loading ? <p role="status" className="runnit-showcase-placeholder">Gespeicherte Duelle werden geladen …</p>
              : error ? <div className="runnit-showcase-error" role="alert"><span>{error}</span>
                  <button type="button" onClick={refresh}><RefreshCw size={16} /> Neu laden</button>
                </div>
                : completed ? <Link to="/stats" className="runnit-showcase-recent-race" aria-label="Duell in der Laufhistorie ansehen">
                    <span className="runnit-showcase-opponent-icon"><UserRound aria-hidden="true" /></span>
                    <span className="runnit-showcase-opponent">vs <strong>{completed.opponentName || 'Gegner'}</strong>
                      <small>{completed.distanceM} M · SERVERGESPEICHERT</small></span>
                    <span className={'runnit-showcase-result ' + (completed.outcome === 'won' ? 'is-win' : '')}>{outcome}</span>
                    <strong className="runnit-showcase-time">{formatRaceTime(completed.timeMs)}</strong>
                  </Link>
                  : <Link to="/map" className="runnit-showcase-placeholder runnit-showcase-placeholder-link">Noch kein abgeschlossenes Duell. <ChevronRight aria-hidden="true" size={17} /></Link>}
        </section>

        <section className="runnit-showcase-goal" aria-label="Dein nächster Sieg-Meilenstein">
          <div className="runnit-showcase-section-head">
            <h2><Target aria-hidden="true" /> DEIN ZIEL</h2><small>NÄCHSTER MEILENSTEIN</small>
          </div>
          <p>{milestone.target} Siege erreichen</p>
          <div className="runnit-showcase-goal-track">
            <div role="progressbar" aria-label="Siege bis zum nächsten Meilenstein"
              aria-valuemin={milestone.start} aria-valuemax={milestone.target}
              aria-valuenow={ready ? totals.wins : undefined}
              aria-valuetext={ready ? totals.wins + ' von ' + milestone.target + ' Siegen' : 'Nicht verfügbar'}
              className="runnit-showcase-goal-progress">
              <span style={{ width: ready ? milestone.percent + '%' : '0%' }} />
            </div>
            <strong>{ready ? totals.wins + ' / ' + milestone.target : '— / ' + milestone.target}</strong>
          </div>
        </section>

        <section className="runnit-showcase-records" aria-labelledby="home-records-title">
          <div className="runnit-showcase-section-head">
            <h2 id="home-records-title"><Zap aria-hidden="true" /> DEINE BESTZEITEN</h2>
            <Link to="/leaderboard?tab=records">ALLE REKORDE <span aria-hidden="true">»</span></Link>
          </div>
          <div className="runnit-showcase-record-grid">
            {RECORD_DISTANCES.map(distance => (
              <Link to="/leaderboard?tab=records" key={distance} className={'runnit-showcase-record ' + (bestTimes[distance] != null ? 'has-record' : '')}
                aria-label={distance + ' Meter Bestzeit: ' + formatRaceTime(bestTimes[distance])}>
                <small>{distance} M</small>
                <strong>{formatRaceTime(bestTimes[distance])}</strong>
              </Link>
            ))}
          </div>
        </section>
        <div className="runnit-showcase-note" aria-live="polite">{!userId ? 'GASTMODUS · DUELLE ERFORDERN EINE ANMELDUNG' : error ? 'DATENVERBINDUNG PRÜFEN' : ''}</div>
      </div>
      <BottomNav />
    </main>
  );
}
