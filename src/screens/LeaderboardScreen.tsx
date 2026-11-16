import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, Building2, Check, Crown, Flag, Flame, Gauge, Globe2, Medal,
  MapPin, ShieldAlert, Swords, Target, Timer, Trophy, UserRound, Users, Zap
} from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import ArcadeAvatar, { type ArcadeAvatarVariant } from '../components/leaderboard/ArcadeAvatar';
import '../styles/arenaArcade.css';

/**
 * THE ARENA – layout follows the three latest user-approved visual references.
 * All people, ratings, records and head-to-head results below are deliberately
 * FICTIONAL SHOWCASE data. No verified leaderboard service exists yet; do not
 * silently convert these display values to official Supabase results.
 */
type ArenaTab = 'rivals' | 'ladder' | 'legends';
type Scope = 'city' | 'country' | 'global';
type Metric = 'times' | 'speed' | 'acceleration' | 'reaction' | 'wins' | 'streak';
type Distance = 50 | 75 | 100;
type Runner = { name: string; level: number; rating: number; avatar: ArcadeAvatarVariant };

const runners: readonly Runner[] = [
  { name: 'SpeedKaze', level: 36, rating: 1488, avatar: 'speed' },
  { name: 'NightRunner', level: 34, rating: 1456, avatar: 'night' },
  { name: 'AeroFox', level: 33, rating: 1418, avatar: 'aero' },
  { name: 'RunHikari', level: 28, rating: 1382, avatar: 'hikari' },
  { name: 'VoltRider', level: 27, rating: 1360, avatar: 'hikari' },
  { name: 'BlazeNeo', level: 27, rating: 1354, avatar: 'night' },
  { name: 'IceSprint', level: 26, rating: 1337, avatar: 'aero' },
  { name: 'MetroDash', level: 26, rating: 1329, avatar: 'speed' },
  { name: 'SkyTracer', level: 25, rating: 1316, avatar: 'night' },
  { name: 'PulseVex', level: 25, rating: 1308, avatar: 'hikari' },
];
const records: readonly Runner[] = [
  runners[0], runners[2], runners[1], runners[3], runners[4],
  { name: 'SkyDash', level: 31, rating: 1302, avatar: 'aero' },
  { name: 'FlashZero', level: 30, rating: 1298, avatar: 'night' },
  { name: 'MetroRacer', level: 29, rating: 1290, avatar: 'speed' },
  { name: 'TurboNix', level: 26, rating: 1281, avatar: 'aero' },
  { name: 'BlazeRune', level: 28, rating: 1276, avatar: 'player' },
];
const bestTimes: Record<Distance, readonly number[]> = {
  50: [5.23, 5.48, 5.51, 5.57, 5.62, 5.64, 5.67, 5.69, 5.71, 5.74],
  75: [7.86, 7.97, 8.01, 8.06, 8.09, 8.13, 8.16, 8.20, 8.24, 8.27],
  100: [10.41, 10.52, 10.56, 10.61, 10.65, 10.69, 10.73, 10.76, 10.79, 10.83],
};
const recordData: Record<Exclude<Metric, 'times'>, readonly number[]> = {
  speed: [11.42, 11.37, 11.29, 11.24, 11.21, 11.18, 11.16, 11.13, 11.11, 11.08],
  acceleration: [4.21, 4.17, 4.09, 4.02, 3.98, 3.96, 3.93, 3.91, 3.89, 3.87],
  reaction: [0.152, 0.159, 0.164, 0.171, 0.176, 0.182, 0.187, 0.191, 0.196, 0.202],
  wins: [68, 65, 62, 59, 54, 49, 46, 44, 41, 38],
  streak: [16, 14, 12, 11, 10, 9, 8, 7, 6, 5],
};
const selfScores: Record<Metric, number> = {
  times: 0, speed: 10.63, acceleration: 3.41,
  reaction: 0.235, wins: 18, streak: 3,
};
const metrics = [
  { id: 'times', title: 'BESTZEITEN', icon: Timer },
  { id: 'speed', title: 'TOP SPEED', icon: Gauge },
  { id: 'acceleration', title: 'BESCHLEUNIGUNG', icon: Zap },
  { id: 'reaction', title: 'REAKTION', icon: Timer },
  { id: 'wins', title: 'SIEGE', icon: Trophy },
  { id: 'streak', title: 'WIN STREAK', icon: Flame },
] as const;
const scopes = [
  { id: 'city', label: 'STADT', icon: Building2 },
  { id: 'country', label: 'LAND', icon: Flag },
  { id: 'global', label: 'GLOBAL', icon: Globe2 },
] as const;
const tabs = [
  { id: 'rivals', label: 'RIVALS' },
  { id: 'ladder', label: 'LADDER' },
  { id: 'legends', label: 'LEGENDS' },
] as const;

const scoreNumber = (value: number, precision: number) => value.toFixed(precision).replace('.', ',');
function recordText(metric: Metric, distance: Distance, index: number): string {
  if (metric === 'times') return scoreNumber(bestTimes[distance][index], 2) + ' s';
  if (metric === 'speed') return scoreNumber(recordData.speed[index], 2) + ' m/s';
  if (metric === 'acceleration') return scoreNumber(recordData.acceleration[index], 2) + ' m/s²';
  if (metric === 'reaction') return scoreNumber(recordData.reaction[index], 3) + ' s';
  if (metric === 'wins') return String(recordData.wins[index]);
  return String(recordData.streak[index]);
}
function selfScore(metric: Metric, distance: Distance): string {
  if (metric === 'times') return (distance === 50 ? '6,92' : distance === 75 ? '9,12' : '13,65') + ' s';
  if (metric === 'speed') return scoreNumber(selfScores.speed, 2) + ' m/s';
  if (metric === 'acceleration') return scoreNumber(selfScores.acceleration, 2) + ' m/s²';
  if (metric === 'reaction') return scoreNumber(selfScores.reaction, 3) + ' s';
  return String(selfScores[metric]);
}
function Avatar({ variant, large = false }: { variant: ArcadeAvatarVariant; large?: boolean }) {
  return <span className={'arena-avatar' + (large ? ' arena-avatar--large' : '')}><ArcadeAvatar variant={variant} /></span>;
}
function SectionBar({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className="arena-section-bar"><span aria-hidden="true">{icon}</span><strong>{children}</strong><span className="arena-section-sky" aria-hidden="true" /></div>;
}
function ScopeTabs({ value, onChange }: { value: Scope; onChange: (value: Scope) => void }) {
  return (
    <div className="arena-scope" role="group" aria-label="Geografischer Vergleich">
      {scopes.map(({ id, label, icon: Icon }) =>
        <button key={id} type="button" aria-pressed={value === id}
          onClick={() => onChange(id)} className={'arena-scope-button' + (value === id ? ' is-active' : '')}>
          <Icon aria-hidden="true" /> {label}
        </button>)}
    </div>
  );
}
function DemoRow({ rank, runner, value, current = false }: {
  rank: number; runner: Runner; value: string; current?: boolean;
}) {
  return (
    <li className={'arena-board-row' + (rank === 1 ? ' is-first' : '') + (current ? ' is-current' : '')}>
      <span className="arena-board-rank">{rank === 1 ? <Crown aria-label="Erster Platz" /> : '#' + rank}</span>
      <Avatar variant={runner.avatar} />
      <strong className="arena-board-name">{runner.name}</strong>
      <span className="arena-board-level">LV. {runner.level}</span>
      <strong className="arena-board-value">{value}</strong>
    </li>
  );
}
function LeaderboardList({ title, entries, values, selfValue, scope, currentName }: {
  title: string; entries: readonly Runner[]; values: readonly string[];
  selfValue: string; scope: Scope; currentName: string;
}) {
  const ownRank = scope === 'city' ? 27 : scope === 'country' ? 132 : 247;
  return (
    <section className="arena-board" aria-label={'Fiktive Top-10-Liste: ' + title}>
      <h2 className="arena-board-title"><BarChart3 aria-hidden="true" />
        TOP 10 – {title} <em>({scopes.find(s => s.id === scope)?.label})</em>
      </h2>
      <div className="arena-board-head"><span>#</span><span>SPIELER</span><span>LV.</span><span>{title === 'LADDER' ? 'RATING' : 'WERT'}</span></div>
      <ol className="arena-board-list">
        {entries.map((entry, index) => (
          <DemoRow key={entry.name} rank={index + 1} runner={entry} value={values[index]} />
        ))}
      </ol>
      <DemoRow rank={ownRank} runner={{ name: currentName, level: 24, rating: 1250, avatar: 'player' }} value={selfValue} current />
    </section>
  );
}
function Rivals({ currentName }: { currentName: string }) {
  const [notice, setNotice] = useState('');
  const rivalRows = [
    { name: 'AeroFox', avatar: 'aero' as const, score: '2 : 3' },
    { name: 'NightRunner', avatar: 'night' as const, score: '1 : 1' },
    { name: 'RunHikari', avatar: 'hikari' as const, score: '1 : 0' },
    { name: 'VoltRider', avatar: 'player' as const, score: '0 : 1' },
    { name: 'MetroRacer', avatar: 'speed' as const, score: 'NEU' },
  ];
  const invites = [
    { name: 'AeroFox', avatar: 'aero' as const, message: 'JETZT ANNEHMEN' },
    { name: 'VoltRider', avatar: 'player' as const, message: 'REVANCHE OFFEN' },
    { name: 'SkyDash', avatar: 'aero' as const, message: 'IN DEINER NÄHE' },
    { name: 'TurboNix', avatar: 'night' as const, message: 'FAST GLEICHES RATING' },
  ];
  const notify = () => setNotice('DESIGNVORSCHAU: Diese Gegner und Herausforderungen sind fiktiv. Echte Rivalen-Einladungen sind noch nicht verbunden.');
  return (
    <div className="arena-rivals arena-panel-area">
      <SectionBar icon={<Swords />}>RIVALS <em>// DUELLE</em></SectionBar>
      <section className="arena-showdown" aria-label="Beispiel für eine persönliche Rivalität">
        <div className="arena-showdown-people">
          <div className="arena-showdown-person"><Avatar variant="player" large /><strong>{currentName}</strong><span>SKILL <b>1250</b></span></div>
          <div className="arena-versus"><strong>VS</strong><small>HEAD-TO-HEAD</small><b>2 : 3</b></div>
          <div className="arena-showdown-person"><Avatar variant="aero" large /><strong>AeroFox</strong><span>SKILL <b>1288</b></span></div>
        </div>
        <button className="arena-rematch" type="button" onClick={notify}>» REVANCHE</button>
      </section>
      <div className="arena-duel-grid">
        <section className="arena-duel-panel">
          <h2><Users aria-hidden="true" /> DEINE RIVALEN</h2>
          {rivalRows.map((r, i) =>
            <button key={r.name} className={'arena-mini-row' + (!i ? ' is-selected' : '')} onClick={notify} type="button">
              <Avatar variant={r.avatar}/><span>{r.name}</span><b>{r.score}</b>
            </button>)}
        </section>
        <section className="arena-duel-panel arena-duel-panel--magenta">
          <h2><Trophy aria-hidden="true" /> OFFENE<br />HERAUSFORDERUNGEN</h2>
          {invites.map((r, i) =>
            <button key={r.name} className="arena-mini-row" onClick={notify} type="button">
              <Avatar variant={r.avatar}/><span>{r.name}</span><b className={'arena-invite-status arena-invite-' + i}>{r.message}</b>
            </button>)}
        </section>
      </div>
      <div className="arena-self-strip"><b>#247</b><Avatar variant="player"/><strong>{currentName}</strong><span>LV. 24</span><small>SKILL</small><b>1250</b></div>
      {notice && <div className="arena-notice" role="status"><ShieldAlert size={16} aria-hidden="true" />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Hinweis schließen"><Check size={16}/></button></div>}
    </div>
  );
}
function Ladder({ scope, setScope, currentName }: { scope: Scope; setScope: (s: Scope) => void; currentName: string }) {
  return (
    <div className="arena-ladder arena-panel-area">
      <SectionBar icon={<BarChart3 />}>LADDER <em>// SKILL RATING</em></SectionBar>
      <ScopeTabs value={scope} onChange={setScope}/>
      <div className="arena-ladder-grid">
        <LeaderboardList title="LADDER" scope={scope} entries={runners} values={runners.map(x => String(x.rating))} selfValue="1250" currentName={currentName}/>
        <aside className="arena-skill-card" aria-label="Beispielhaftes Spielerprofil">
          <h2><UserRound aria-hidden="true" /> DEIN PROFIL</h2>
          <div className="arena-skill-user"><Avatar variant="player" large/><strong>{currentName}</strong><span>LV. 24</span></div>
          <div className="arena-skill-rating"><small>SKILL RATING</small><strong>1250</strong></div>
          <p><Trophy aria-hidden="true"/> SIEGE <b>68</b></p>
          <p><Zap aria-hidden="true"/> SIEGESSERIE <b>5</b></p>
          <p><BarChart3 aria-hidden="true"/> RANG ({scopes.find(s => s.id === scope)?.label}) <b>#{scope === 'city' ? 27 : scope === 'country' ? 132 : 247}</b></p>
          <div className="arena-next-rival"><Target aria-hidden="true"/><small>NÄCHSTER RIVALE</small><Avatar variant="aero"/><strong>AeroFox</strong></div>
        </aside>
      </div>
    </div>
  );
}
function Legends({ scope, setScope, currentName }: { scope: Scope; setScope: (s: Scope) => void; currentName: string }) {
  const [metric, setMetric] = useState<Metric>('acceleration');
  const [distance, setDistance] = useState<Distance>(100);
  const selected = metrics.find(m => m.id === metric)!;
  const values = records.map((_, i) => recordText(metric, distance, i));
  const own = selfScore(metric, distance);
  const champ = values[0];
  return (
    <div className="arena-legends arena-panel-area">
      <SectionBar icon={<Trophy />}>LEGENDS <em>// REKORDE</em></SectionBar>
      <ScopeTabs value={scope} onChange={setScope}/>
      <div className="arena-metrics" role="group" aria-label="Rekordkategorie wählen">
        {metrics.map(({ id, title, icon: Icon }) =>
          <button type="button" key={id} aria-pressed={metric === id}
            onClick={() => setMetric(id)} className={'arena-metric' + (metric === id ? ' is-active' : '')}>
            <Icon aria-hidden="true" /><span>{title}</span>
          </button>)}
      </div>
      <div className="arena-champion" aria-label="Fiktive Rekordhalter-Vorschau">
        {/* The distance picker occupies the champion artwork, never document
            flow: switching BESTZEITEN cannot move the Top 10 up or down. */}
        {metric === 'times' && (
          <div className="arena-distance" role="group" aria-label="Bestzeiten-Distanz">
            {([50, 75, 100] as const).map(m =>
              <button key={m} type="button" onClick={() => setDistance(m)}
                aria-pressed={distance === m} className={distance === m ? 'is-active' : ''}>{m} m</button>)}
          </div>
        )}
        <div className="arena-champion-main">
          <div className="arena-champion-avatar"><Crown aria-hidden="true"/><Avatar variant="speed" large/></div>
          <div className="arena-champion-name"><strong>SpeedKaze</strong><span>{selected.title}</span></div>
          <strong className="arena-champion-score">{champ}</strong>
        </div>
      </div>
      <LeaderboardList title={selected.title + (metric === 'times' ? ' · ' + distance + ' M' : '')}
        scope={scope} entries={records} values={values} selfValue={own} currentName={currentName}/>
    </div>
  );
}
export default function LeaderboardScreen({ displayName }: { displayName?: string | null }) {
  const [tab, setTab] = useState<ArenaTab>('rivals');
  const [scope, setScope] = useState<Scope>('global');
  const currentName = displayName?.trim() || 'Stergios';
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = event.key;
    let target = index;
    if (key === 'ArrowRight') target = (index + 1) % tabs.length;
    else if (key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
    else if (key === 'Home') target = 0;
    else if (key === 'End') target = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[target].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus();
  };
  return (
    <main className="arena-screen" aria-label="RUNNIT Arena">
      <div className="arena-stage">
        <header className="arena-hero">
          <div className="arena-hero-top">
            <img src="/runnit-metal-logo.svg" alt="RUNNIT" className="arena-logo"/>
            <Link to="/profile" className="arena-profile-button" aria-label="Profil öffnen"><UserRound aria-hidden="true"/></Link>
          </div>
          <p className="arena-motto">CHALLENGE. <em>RACE.</em> <b>BEAT.</b></p>
          <h1>ARENA</h1>
          <p className="arena-hero-bottom">RIVALS. &nbsp; LADDER. &nbsp; <em>LEGENDS.</em></p>
        </header>
        <nav className="arena-tabs" role="tablist" aria-label="Arena Bereiche">
          {tabs.map(({ id, label }, index) =>
            <button key={id} id={'arena-tab-' + id} role="tab" type="button" aria-selected={tab === id}
              aria-controls={'arena-panel-' + id} tabIndex={tab === id ? 0 : -1}
              onKeyDown={event => onTabKeyDown(event, index)}
              onClick={() => setTab(id)} className={tab === id ? 'is-active' : ''}>{label}</button>)}
        </nav>
        <div className="arena-content" role="tabpanel" id={'arena-panel-' + tab} aria-labelledby={'arena-tab-' + tab}>
          {tab === 'rivals' ? <Rivals currentName={currentName}/> :
            tab === 'ladder' ? <Ladder scope={scope} setScope={setScope} currentName={currentName}/> :
              <Legends scope={scope} setScope={setScope} currentName={currentName}/>}
        </div>
        <div className="arena-demo-note" role="note"><ShieldAlert aria-hidden="true"/> DESIGNVORSCHAU · FIKTIVE NAMEN, RÄNGE UND REKORDE · NICHT VERIFIZIERT</div>
      </div>
      <BottomNav/>
    </main>
  );
}
