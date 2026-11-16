import { useState, type KeyboardEvent } from 'react';
import { ChevronLeft, Crown, MapPinned, ShieldAlert, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import ArcadeAvatar, { type ArcadeAvatarVariant } from '../components/leaderboard/ArcadeAvatar';
import { leaderboardSourceLabel } from '../lib/leaderboardProvenance';
import BottomNav from '../components/ui/BottomNav';
import '../styles/leaderboardArcade.css';

/** Explicitly fictional scene dressing matching the user-supplied arcade
 * reference. No real users, verification, friends or player XP/points exist
 * in this data source. Never merge these records with server results. */
const showcase: ReadonlyArray<{
  name: string; level: number; points: number; avatar: ArcadeAvatarVariant; source: 'demo'; featured?: boolean;
}> = [
  { name: 'SpeedKaze',   level: 36, points: 5420, avatar: 'speed', source: 'demo' },
  { name: 'NightRunner', level: 34, points: 5210, avatar: 'night', source: 'demo' },
  { name: 'AeroFox',     level: 33, points: 5080, avatar: 'aero', source: 'demo' },
  { name: 'Stergios',    level: 24, points: 4920, avatar: 'player', source: 'demo', featured: true },
  { name: 'RunHikari',   level: 28, points: 4760, avatar: 'hikari', source: 'demo' },
];

type RankingTab = 'global' | 'region' | 'friends';
const tabs: ReadonlyArray<{ id: RankingTab; label: string }> = [
  { id: 'global', label: 'GLOBAL' },
  { id: 'region', label: 'REGION' },
  { id: 'friends', label: 'FREUNDE' },
];

const points = new Intl.NumberFormat('de-DE');

function ArcadeShowcaseRow({ entry, rank }: { entry: (typeof showcase)[number]; rank: number }) {
  return (
    <li className={'runnit-ranking-row' + (entry.featured ? ' is-featured' : '')}
      aria-label={`Demo-Platz ${rank}: ${entry.name}, fiktives Level ${entry.level}, ${points.format(entry.points)} Demo-Punkte; ${leaderboardSourceLabel(entry.source)}`}>
      <div className={'runnit-ranking-place' + (rank === 1 ? ' is-gold' : '')} aria-hidden="true">
        {rank === 1 && <Crown />}
        <strong>{rank}</strong>
      </div>
      <span className="runnit-ranking-avatar"><ArcadeAvatar variant={entry.avatar} /></span>
      <div className="runnit-ranking-person">
        <strong title={entry.name}>{entry.name}</strong>
        <small>LV. {entry.level}</small>
      </div>
      <div className="runnit-ranking-points" aria-hidden="true">
        <strong>{points.format(entry.points)}</strong><span>Pkt</span>
      </div>
    </li>
  );
}

function NoVerifiedResults({ scope }: { scope: 'region' | 'friends' }) {
  const isFriends = scope === 'friends';
  return (
    <section className="runnit-ranking-no-results" role="status" aria-label={isFriends ? 'Freundesrangliste ohne bestätigte Ergebnisse' : 'Regionale Rangliste ohne bestätigte Ergebnisse'}>
      <span className="runnit-ranking-empty-emblem" aria-hidden="true">
        {isFriends ? <Users size={37} /> : <MapPinned size={37} />}
      </span>
      <h2>{isFriends ? 'DEIN SQUAD. DEIN RIVAL.' : 'DEINE STRASSE. DEIN REVIER.'}</h2>
      <p>{isFriends
        ? 'Sobald Freundeslisten und geprüfte Sprint-Ergebnisse verfügbar sind, erscheinen hier echte Duelle zwischen deinen Kontakten.'
        : 'Die regionale Bestenliste wird mit echten, geprüften Sprint-Ergebnissen gefüllt. Bis dahin zeigen wir keine erfundenen Platzierungen.'}</p>
      <span className="runnit-ranking-empty-stripes" aria-hidden="true"><span /><span /><span /></span>
    </section>
  );
}

export default function LeaderboardScreen() {
  const [activeTab, setActiveTab] = useState<RankingTab>('global');

  // Tablist keyboard access: Arrow keys, Home and End select/focus a new tab.
  // This keeps Region/Freunde reachable even with roving tabIndex=-1.
  const selectTabFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = event.key;
    let next = index;
    if (key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (key === 'Home') next = 0;
    else if (key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    setActiveTab(tabs[next].id);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  };

  return (
    <main className="runnit-ranking-screen" aria-label="Runnit Ranglisten">
      <div className="runnit-ranking-stage">
        <header className="runnit-ranking-header">
          <Link to="/home" className="runnit-ranking-back" aria-label="Zur Startseite">
            <ChevronLeft size={32} strokeWidth={2.6} aria-hidden="true" />
          </Link>
          <span className="runnit-ranking-trophy" aria-hidden="true"><Trophy /></span>
          <div className="runnit-ranking-header-copy">
            <h1>RANGLISTE</h1>
          </div>
        </header>

        <div className="runnit-ranking-tabs" role="tablist" aria-label="Ranglistenbereich">
          {tabs.map(({ id, label }, index) => (
            <button key={id} id={'ranking-tab-' + id} type="button" role="tab"
              className="runnit-ranking-tab"
              aria-selected={activeTab === id}
              aria-controls={'ranking-panel-' + id}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setActiveTab(id)}
              onKeyDown={(event) => selectTabFromKeyboard(event, index)}>
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={'ranking-panel-' + activeTab}
          aria-labelledby={'ranking-tab-' + activeTab}>
          {activeTab === 'global' ? (
            <ol className="runnit-ranking-list" aria-label="Fiktive globale Beispiel-Rangliste">
              {showcase.map((entry, index) => (
                <ArcadeShowcaseRow key={entry.name} entry={entry} rank={index + 1} />
              ))}
            </ol>
          ) : (
            <NoVerifiedResults scope={activeTab} />
          )}
        </div>

        <div className="runnit-ranking-city">
          <p className="runnit-ranking-demo-ribbon" role="note">
            <ShieldAlert aria-hidden="true" />
            <span><strong>DESIGNVORSCHAU / DEMO</strong> · Alle Namen, Level und Punkte unten sind fiktiv. Noch keine offiziellen Sprint-Ränge.</span>
          </p>
        </div>
        <p className="sr-only">Erst unabhängig geprüfte Rennergebnisse dürfen später als echte Platzierungen erscheinen.</p>
      </div>
      <BottomNav />
    </main>
  );
}
