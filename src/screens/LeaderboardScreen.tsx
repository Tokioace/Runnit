import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, Crown, Flag, RefreshCw, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import BottomNav from '../components/ui/BottomNav';
import { supabase } from '../lib/supabaseClient';
import { formatRaceTime } from '../lib/runnerHistory';
import '../styles/leaderboardArcade.css';

type RankingMode = 'duels' | '50' | '75' | '100';
const modes: ReadonlyArray<{id: RankingMode; label: string; caption: string}> = [
  { id: 'duels', label: 'DUELLE', caption: 'SORTIERT NACH SIEGEN' },
  { id: '50', label: '50 M', caption: 'BESTZEIT 50 M' },
  { id: '75', label: '75 M', caption: 'BESTZEIT 75 M' },
  { id: '100', label: '100 M', caption: 'BESTZEIT 100 M' },
];

type RankingEntry = {
  rank_position: number; user_id: string; username: string;
  best_time_ms: number | null; races_count: number; wins_count: number;
};

type Props = { userId?: string | null };
export default function LeaderboardScreen({ userId }: Props) {
  const [mode, setMode] = useState<RankingMode>('duels');
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(n => n + 1), []);

  useEffect(() => {
    if (!userId) { setEntries([]); setConsent(null); setLoading(false); setError(null); return; }
    let mounted = true;
    setLoading(true);
    setError(null);
    const run = async () => {
      try {
        const [rankingResponse, profileResponse] = await Promise.all([
          supabase.rpc('list_beta_duel_leaderboard', {
            p_target_distance_m: mode === 'duels' ? null : Number(mode),
            p_limit: 50,
          }),
          supabase.from('users').select('leaderboard_opt_in').eq('id',userId).maybeSingle(),
        ]);
        if (rankingResponse.error) throw rankingResponse.error;
        if (profileResponse.error) throw profileResponse.error;
        if (mounted) {
          setEntries((rankingResponse.data ?? []) as RankingEntry[]);
          setConsent(profileResponse.data?.leaderboard_opt_in === true);
          setLoading(false);
        }
      } catch {
        if (mounted) {setEntries([]);setError('Rangliste konnte nicht vom Server geladen werden.');setLoading(false);}
      }
    };
    void run();
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { mounted = false; window.removeEventListener('focus', onFocus); };
  }, [userId,mode,revision,refresh]);

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index+1)%modes.length;
    else if (event.key === 'ArrowLeft') next = (index-1+modes.length)%modes.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = modes.length-1;
    else return;
    event.preventDefault();
    setMode(modes[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  const selected = modes.find(m => m.id===mode)!;
  return (
    <main className="runnit-ranking-screen" aria-label="Echte Runnit Beta-Rangliste">
      <div className="runnit-ranking-stage">
        <header className="runnit-ranking-header">
          <Link to="/home" className="runnit-ranking-back" aria-label="Zur Startseite"><ChevronLeft size={32} strokeWidth={2.6}/></Link>
          <span className="runnit-ranking-trophy"><Trophy aria-hidden="true"/></span>
          <div className="runnit-ranking-header-copy">
            <h1>RANGLISTE</h1>
            <p className="mt-1 text-[10px] font-black tracking-widest text-cyan-200">RUNNIT // BETA</p>
          </div>
        </header>

        <p className="mt-2 px-4 text-xs leading-5 text-white/70">
          Keine Demo-Namen, keine erfundenen Punkte. Nur beidseitig gespeicherte und abgeschlossene Duelle.
        </p>
        <div className="runnit-ranking-tabs" role="tablist" aria-label="Wettbewerb wählen">
          {modes.map(({id,label},i) => <button key={id} id={'ranking-tab-'+id} type="button"
            role="tab" aria-selected={mode===id} aria-controls="ranking-panel"
            tabIndex={mode===id?0:-1} className="runnit-ranking-tab"
            onClick={() => setMode(id)} onKeyDown={e => handleKey(e,i)}>
            {label}
          </button>)}
        </div>

        <div role="tabpanel" id="ranking-panel" aria-labelledby={'ranking-tab-'+mode} className="min-h-40">
          <p className="my-3 px-4 text-[10px] font-black tracking-widest text-lime-300">{selected.caption}</p>
          {!userId ? (
            <section className="runnit-ranking-no-results" role="status">
              <UserRound className="mx-auto mb-3 h-10 w-10 text-cyan-200" aria-hidden="true"/>
              <h2>RUNNER-ANMELDUNG</h2>
              <p>Melde dich an, um die echte Beta-Rangliste anzusehen.</p>
              <Link to="/login?next=%2Fleaderboard" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-cyan-300/50 px-4 text-sm font-black text-cyan-100">ANMELDEN</Link>
            </section>
          ) : loading ? (
            <p role="status" className="px-4 py-8 text-center text-sm text-cyan-100">GESPEICHERTE ERGEBNISSE WERDEN GELADEN …</p>
          ) : error ? (
            <section className="runnit-ranking-no-results" role="alert">
              <h2>VERBINDUNGSFEHLER</h2><p>{error}</p>
              <button type="button" onClick={refresh} className="mt-4 inline-flex min-h-11 items-center gap-2 text-cyan-200"><RefreshCw className="h-4 w-4"/>ERNEUT LADEN</button>
            </section>
          ) : entries.length ? (
            <ol className="runnit-ranking-list" aria-label={'Gespeicherte '+selected.label+'-Bestenliste'}>
              {entries.map(entry => <li key={entry.user_id}
                className={'runnit-ranking-row'+(entry.user_id===userId?' is-featured':'')}
                aria-label={'Platz '+entry.rank_position+': '+entry.username}>
                <span className={'runnit-ranking-place'+(entry.rank_position===1?' is-gold':'')}>
                  {entry.rank_position===1&&<Crown aria-hidden="true"/>}<strong>{entry.rank_position}</strong>
                </span>
                <span className="runnit-ranking-avatar"><UserRound className="h-6 w-6 text-cyan-200" aria-hidden="true"/></span>
                <span className="runnit-ranking-person">
                  <strong title={entry.username}>{entry.username}{entry.user_id===userId?' · DU':''}</strong>
                  <small>{entry.races_count} abgeschlossene Duelle · {entry.wins_count} Siege</small>
                </span>
                <span className="runnit-ranking-points">
                  <strong>{mode==='duels'?String(entry.wins_count):formatRaceTime(entry.best_time_ms)}</strong>
                  <span>{mode==='duels'?'SIEGE':'ZEIT'}</span>
                </span>
              </li>)}
            </ol>
          ) : (
            <section className="runnit-ranking-no-results" role="status">
              <Flag className="mx-auto mb-3 h-10 w-10 text-cyan-200" aria-hidden="true"/>
              <h2>NOCH KEINE EINTRÄGE</h2>
              <p>Für {mode==='duels'?'die Duellwertung':selected.label} gibt es noch keine freigegebenen, vollständig gespeicherten Ergebnisse.</p>
            </section>
          )}
        </div>

        {userId && consent===false && (
          <div className="runnit-ranking-city">
            <p className="text-xs leading-5 text-cyan-100/75">Deine Ergebnisse bleiben privat, bis du die Anzeige in der Bestenliste im Profil ausdrücklich freigibst.</p>
            <Link to="/profile" className="mt-2 inline-flex min-h-10 items-center text-xs font-black text-lime-300">RANGLISTEN-FREIGABE ÖFFNEN ›</Link>
          </div>
        )}
        <div className="runnit-ranking-city">
          <p className="flex items-start gap-2 text-[11px] leading-5 text-white/65">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true"/>
            BETA-MESSUNGEN: Die Zeiten stammen aus gespeicherten 1v1-Ergebnissen und sind noch nicht unabhängig gegen Manipulation verifiziert. Ghost-Trainings und abgebrochene Rennen zählen nicht.
          </p>
        </div>
      </div>
      <BottomNav/>
    </main>
  );
}

