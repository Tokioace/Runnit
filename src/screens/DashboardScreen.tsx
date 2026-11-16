import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, CircleHelp, Flag, Flame, Ghost, MapPin, Play, ShieldAlert, Swords, Trophy, UserRound, X } from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import ArcadeAvatar from '../components/leaderboard/ArcadeAvatar';
import '../styles/playArcade.css';

type VerifiedRacePreview = {
  id: string;
  title: string;
  location: string;
  time: string;
  source: 'verified';
};
type VerifiedRankPreview = {
  id: string;
  name: string;
  position: number;
  scoreLabel: string;
  source: 'verified';
};
type Props = {
  displayName?: string | null;
  recentRaces?: readonly VerifiedRacePreview[];
  rankings?: readonly VerifiedRankPreview[];
};

type RaceMode = 'duel' | 'ghost';
type RaceDistance = 50 | 75 | 100;

/**
 * PLAY is the first stop after login. It answers one question: "What do I do
 * right now?" It deliberately does not duplicate MAP discovery or ARENA stats.
 * Official records appear only when a 'verified' source is provided. The
 * featured RIVAL WANTED card never invents a head-to-head relationship.
 */
export default function DashboardScreen({ displayName, recentRaces = [], rankings = [] }: Props) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [mode, setMode] = useState<RaceMode>('duel');
  const [distance, setDistance] = useState<RaceDistance>(50);
  const nickname = displayName?.trim() || 'RUNNER';
  const verifiedRaces = recentRaces.filter(race => race.source === 'verified');
  const verifiedRankings = rankings.filter(rank => rank.source === 'verified');
  const verifiedRank = verifiedRankings[0];

  return (
    <main className="play-screen" aria-label="RUNNIT PLAY">
      <div className="play-stage">
        <header className="play-hero" aria-label="RUNNIT – Challenge. Race. Beat.">
          <img className="play-hero-logo" src="/runnit-metal-logo.svg" alt="RUNNIT" />
          <p className="play-hero-motto">CHALLENGE. <em>RACE.</em> <strong>BEAT.</strong></p>
          <img className="play-hero-runner" src="/runnit-arena-reference-runner.svg" alt="" aria-hidden="true" draggable={false} />
          <div className="play-hero-title"><span className="play-street-tag">THE STREET IS YOURS</span><h1>PLAY</h1><p>DEIN LAUF. DEINE CHALLENGE.</p></div>
          <Link to="/profile" className="play-hero-profile" aria-label="Profil und persönliche Statistiken öffnen"><UserRound aria-hidden="true" /></Link>
        </header>

        <section className="play-hud" aria-label="Dein Fahrerprofil">
          <span className="play-hud-avatar" aria-hidden="true"><ArcadeAvatar variant="player" /></span>
          <div className="play-hud-info">
            <span>WELCOME BACK,</span>
            <strong>{nickname.toUpperCase()}!</strong>
            <small>YOUR NEXT CHALLENGE AWAITS</small>
          </div>
          <Link className="play-hud-rank" to="/leaderboard" aria-label="Deine Position in der Arena anzeigen">
            <Trophy aria-hidden="true" />
            <span>RANG</span>
            <strong>{verifiedRank ? '#' + verifiedRank.position : '—'}</strong>
          </Link>
        </section>

        <section className="play-start" aria-label="Jetzt laufen">
          <div className="play-start-head"><span>READY TO RACE?</span><span>01 / LET'S GO</span></div>
          <button type="button" className="play-run-button" onClick={() => { setMode('duel'); setChooserOpen(true); }} aria-haspopup="dialog">
            <Play className="play-run-icon" aria-hidden="true" fill="currentColor" />
            <span>RUN <em>NOW</em></span>
            <span className="play-run-chevrons" aria-hidden="true">»</span>
          </button>
          <p>SPRINT. CHALLENGE. MAKE YOUR MARK.</p>
        </section>

        <section className="play-rival" aria-labelledby="play-rival-heading">
          <div className="play-rival-header">
            <span className="play-rival-heading-icon"><Swords aria-hidden="true" /></span>
            <h2 id="play-rival-heading">RIVAL <em>WANTED</em></h2>
            <span className="play-rival-no-results">DEIN NÄCHSTER MOVE</span>
          </div>
          <div className="play-rival-body">
            <div className="play-rival-portraits" aria-hidden="true">
              <span className="play-rival-face"><ArcadeAvatar variant="player" /></span>
              <strong>VS</strong>
              <span className="play-rival-mystery"><CircleHelp /></span>
            </div>
            <div className="play-rival-message">
              <strong>WER WIRD DEIN ERSTER RIVALE?</strong>
              <p>Starte ein 1v1. Aus einem Duell kann eine Rivalität werden.</p>
              <button type="button" onClick={() => { setMode('duel'); setChooserOpen(true); }}>
                CHALLENGE STARTEN <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <div className="play-discovery">
          <Link to="/map?view=list" className="play-discovery-link">
            <MapPin aria-hidden="true" />
            <span><strong>NEAR YOU</strong><small>Rennen & Spieler finden</small></span>
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link to="/leaderboard" className="play-discovery-link play-discovery-link--arena">
            <Flame aria-hidden="true" />
            <span><strong>BUILD YOUR LEGACY</strong><small>Rivalen · Rating · Rekorde</small></span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <p className="play-provenance">
          <ShieldAlert aria-hidden="true" />
          {verifiedRaces.length ? 'Echte Ergebnisse erscheinen in deinem Profil.' : 'Noch keine verifizierten Rennen oder Platzierungen.'}
        </p>
      </div>
      <BottomNav />

      {chooserOpen && (
        <div className="play-modal-backdrop" role="presentation" onClick={() => setChooserOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="play-mode-title" className="play-mode-dialog" onClick={event => event.stopPropagation()}>
            <div className="play-mode-head">
              <div><span>RUNNIT / PLAY</span><h2 id="play-mode-title">CHOOSE YOUR <em>RACE</em></h2></div>
              <button type="button" className="play-mode-close" onClick={() => setChooserOpen(false)} aria-label="Modusauswahl schließen"><X aria-hidden="true" /></button>
            </div>
            <div className="play-mode-cards" role="group" aria-label="Rennmodus wählen">
              <button type="button" className={'play-mode-card' + (mode === 'duel' ? ' is-selected' : '')} aria-pressed={mode === 'duel'} onClick={() => setMode('duel')}>
                <Swords aria-hidden="true" /><strong>1V1 DUELL</strong><small>Gegen einen echten Gegner</small>
              </button>
              <button type="button" className={'play-mode-card' + (mode === 'ghost' ? ' is-selected' : '')} aria-pressed={mode === 'ghost'} onClick={() => setMode('ghost')}>
                <Ghost aria-hidden="true" /><strong>GHOST RUN</strong><small>Deine Bestzeit herausfordern</small>
              </button>
            </div>

            {mode === 'duel' ? (
              <>
                <p className="play-distance-caption"><Flag aria-hidden="true" /> SPRINTDISTANZ</p>
                <div className="play-distance" role="group" aria-label="Sprintdistanz wählen">
                  {([50, 75, 100] as const).map(m => (
                    <button key={m} type="button" aria-pressed={distance === m} className={distance === m ? 'is-selected' : ''} onClick={() => setDistance(m)}>{m} M</button>
                  ))}
                </div>
                <Link to={'/map?play=duel&distance=' + distance} className="play-mode-continue" onClick={() => setChooserOpen(false)}>
                  STARTPUNKT WÄHLEN <ArrowRight aria-hidden="true" />
                </Link>
                <p className="play-mode-helper">Auf der Karte einen Punkt in deinem 500-m-Radius halten. Danach wird das Duell mit der gewählten Distanz vorbereitet.</p>
              </>
            ) : (
              <div className="play-ghost-unavailable" role="status"><Ghost aria-hidden="true"/><strong>GHOST RUN IST IN VORBEREITUNG</strong><p>Der Modus wird erst freigeschaltet, wenn die Aufzeichnung und Verifikation eigener Läufe funktioniert. Bis dahin kannst du echte 1v1-Rennen erstellen.</p><button type="button" onClick={() => setMode('duel')}>1V1 WÄHLEN <ChevronRight aria-hidden="true"/></button></div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
