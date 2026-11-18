import { Link } from 'react-router-dom';
import { Bell, ChevronRight, FlagTriangleRight, Play, Swords, Target, Timer, Trophy, UserRound, Zap } from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import { useRunnerHistory } from '../hooks/useRunnerHistory';
import { formatRaceTime } from '../lib/runnerHistory';
import '../styles/runnitHomeV2.css';

type DashboardProps = { displayName?: string | null; userId?: string | null };

function showTime(value: number | null): string {
  return formatRaceTime(value);
}

export default function DashboardScreen({ displayName, userId }: DashboardProps) {
  const { races, loading, error, totals, refresh } = useRunnerHistory(userId);
  const latest = races.find(race => race.completed) ?? null;
  const wins = totals.wins;
  const milestone = Math.max(5, (Math.floor(wins / 5) + 1) * 5);
  const progress = Math.min(100, Math.round(wins / milestone * 100));
  const nickname = displayName?.trim() || (userId ? 'RUNNER' : 'GAST');
  const validData = Boolean(userId) && !loading && !error;
  const lastOutcome = latest?.outcome === 'won' ? 'SIEG'
    : latest?.outcome === 'lost' ? 'NIEDERLAGE'
      : latest?.outcome === 'tie' ? 'REMIS' : 'ERGEBNIS';

  return (
    <main className="runnit-home-v2">
      <div className="runnit-home-v2__content">
        <header className="runnit-home-v2__hero">
          <img className="runnit-home-v2__portrait" src="/runnit-home-half-face.avif"
            width={360} height={517} alt="" aria-hidden="true" />
          <div className="runnit-home-v2__hero-shade" aria-hidden="true" />
          <div className="runnit-home-v2__brand">
            <div className="runnit-home-v2__brandmark">
              <img src="/runnit-metal-logo.svg" alt="RUNNIT" width={840} height={174} />
              <p>CHALLENGE. <em>RACE.</em> <strong>BEAT.</strong></p>
            </div>
            <span className="runnit-home-v2__bell" title="Benachrichtigungen sind noch nicht aktiviert"
              aria-label="Benachrichtigungen noch nicht verfügbar">
              <Bell aria-hidden="true" />
            </span>
          </div>
          <div className="runnit-home-v2__greeting">
            <span>Hallo</span>
            <h1 title={nickname}>{nickname}</h1>
            <i aria-hidden="true" />
            <p>BEREIT FÜR DAS<br />NÄCHSTE DUELL?</p>
          </div>
        </header>

        <section className="runnit-home-v2__score" aria-label="Deine gespeicherten Wettkampfdaten" aria-busy={loading}>
          <div className="runnit-home-v2__score-item">
            <Trophy aria-hidden="true" />
            <strong>{validData ? wins : '—'}</strong>
            <span>{validData && wins === 1 ? 'SIEG' : 'SIEGE'}</span>
          </div>
          <div className="runnit-home-v2__score-item">
            <Swords aria-hidden="true" />
            <strong>{validData ? totals.completedDuels : '—'}</strong>
            <span>{validData && totals.completedDuels === 1 ? 'DUELL' : 'DUELLE'}</span>
          </div>
          <div className="runnit-home-v2__score-item runnit-home-v2__score-item--time">
            <Timer aria-hidden="true" />
            <strong>{validData ? showTime(totals.best50Ms) : '—'}</strong>
            <span>BESTZEIT · 50 M</span>
          </div>
        </section>

        <Link to="/map" className="runnit-home-v2__start"
          aria-label="Zur Karte, um ein Duell zu starten">
          <Play aria-hidden="true" />
          <strong>DUELL STARTEN</strong>
          <span aria-hidden="true">»</span>
        </Link>

        <section className="runnit-home-v2__last" aria-labelledby="last-duel">
          <div className="runnit-home-v2__last-title">
            <h2 id="last-duel"><FlagTriangleRight aria-hidden="true" /> LETZTES DUELL</h2>
            {validData && latest && <time dateTime={latest.occurredAt}>
              {new Date(latest.occurredAt).toLocaleDateString('de-DE')}
            </time>}
          </div>
          {!userId ? (
            <Link to="/login?next=%2Fhome" className="runnit-home-v2__last-empty">
              Melde dich an, um dein letztes Duell zu sehen <ChevronRight size={17} aria-hidden="true" />
            </Link>
          ) : loading ? (
            <p role="status" className="runnit-home-v2__last-empty">ERGEBNIS WIRD GELADEN …</p>
          ) : error ? (
            <div className="runnit-home-v2__last-empty" role="alert">
              <span>{error}</span>
              <button type="button" onClick={refresh}>ERNEUT LADEN</button>
            </div>
          ) : latest ? (
            <div className="runnit-home-v2__last-result">
              <span className="runnit-home-v2__last-avatar"><UserRound aria-hidden="true" /></span>
              <span className="runnit-home-v2__opponent" title={latest.opponentName || 'RUNNER'}>
                vs {latest.opponentName || 'RUNNER'}
              </span>
              <span className={'runnit-home-v2__result-tag ' + (latest.outcome === 'won' ? 'is-win' : '')}>
                {lastOutcome}
              </span>
              <strong className="runnit-home-v2__last-time">{showTime(latest.timeMs)}</strong>
            </div>
          ) : (
            <p className="runnit-home-v2__last-empty">Dein erstes Duell wartet auf dich.</p>
          )}
        </section>

        <section className="runnit-home-v2__goal" aria-labelledby="home-goal-heading">
          <div className="runnit-home-v2__section-title">
            <h2 id="home-goal-heading"><Target aria-hidden="true" /> DEIN ZIEL</h2>
            <span>NÄCHSTER MEILENSTEIN</span>
          </div>
          <p>{validData ? milestone + ' Siege erreichen' : 'Deine nächsten Siege'}</p>
          <div className="runnit-home-v2__progress-row">
            <div className="runnit-home-v2__progress" role="progressbar"
              aria-label="Fortschritt zum nächsten Sieg-Meilenstein"
              aria-valuemin={0} aria-valuemax={validData ? milestone : 5}
              aria-valuenow={validData ? wins : 0}
              aria-valuetext={validData ? wins + ' von ' + milestone + ' Siegen' : 'Noch keine Daten'}>
              <span style={{ width: (validData ? progress : 0) + '%' }} />
            </div>
            <strong>{validData ? wins + ' / ' + milestone : '— / —'}</strong>
          </div>
        </section>

        <section className="runnit-home-v2__records" aria-labelledby="home-records-heading">
          <div className="runnit-home-v2__section-title">
            <h2 id="home-records-heading"><Zap aria-hidden="true" /> DEINE BESTZEITEN</h2>
            <Link to="/leaderboard?tab=records">ALLE REKORDE <ChevronRight aria-hidden="true" /></Link>
          </div>
          <div className="runnit-home-v2__record-grid">
            {([
              { distance: 50, value: totals.best50Ms },
              { distance: 75, value: totals.best75Ms },
              { distance: 100, value: totals.best100Ms },
            ] as const).map(({ distance, value }) => (
              <div className={'runnit-home-v2__record'+(distance === 50 ? ' is-highlighted' : '')}
                key={distance}>
                <span>{distance} M</span>
                <strong>{validData ? showTime(value) : '—'}</strong>
              </div>
            ))}
          </div>
        </section>

        <Link className="runnit-home-v2__solo" to="/ghost-run">
          SOLO TRAINIEREN <ChevronRight aria-hidden="true" />
        </Link>
      </div>
      <BottomNav />
    </main>
  );
}
