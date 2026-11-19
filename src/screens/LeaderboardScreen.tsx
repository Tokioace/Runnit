import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, BarChart3, Crown, Flame, Gauge, Medal, RefreshCw, ShieldAlert, Swords, Timer, Trophy, UserRound, Users, Zap } from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import { useRunnerHistory } from '../hooks/useRunnerHistory';
import { formatRaceTime } from '../lib/runnerHistory';
import { summarizeRivals } from '../lib/competition';
import { supabase } from '../lib/supabaseClient';
import '../styles/runnitCompetition.css';
import '../styles/legendsShowcase.css';

type PageTab = 'rivals' | 'ladder' | 'records';
type Metric = 'times' | 'speed' | 'acceleration' | 'wins' | 'streak' | 'duels';
type Distance = 50 | 75 | 100;
type BoardRow = { rank_position:number; user_id:string; username:string; value:number; races_count:number; wins_count:number };
type PublicRow = { rank_position:number; user_id:string; username:string; best_time_ms:number|null; races_count:number; wins_count:number };
type RecordRow = { rank_position:number; user_id:string; username:string; metric_value:number|null; races_count:number; wins_count:number };
const tabs = [
 { id:'rivals',label:'RIVALEN',Icon:Users },{ id:'ladder',label:'WERTUNG',Icon:BarChart3 },{ id:'records',label:'REKORDE',Icon:Trophy },
] as const;
const metrics = [
 { id:'times',label:'BESTZEITEN',Icon:Timer },
 { id:'speed',label:'TOP SPEED',Icon:Gauge },
 { id:'acceleration',label:'BESCHLEUN.',Icon:Zap },
 { id:'wins',label:'SIEGE',Icon:Trophy },
 { id:'streak',label:'SIEGESSERIE',Icon:Flame },
 { id:'duels',label:'DUELLE',Icon:Swords },
] as const;

function metricLabel(metric:Metric):string { return metrics.find(m=>m.id===metric)?.label ?? 'REKORDE'; }
function valueText(value:number,metric:Metric):string {
 if(!Number.isFinite(value))return '—';
 if(metric==='times')return formatRaceTime(value);
 if(metric==='speed')return value.toFixed(2).replace('.',',')+' m/s';
 if(metric==='acceleration')return value.toFixed(2).replace('.',',')+' m/s²';
 return String(Math.round(value));
}
function countLabel(count:number,singular:string,plural:string):string {
 return String(count)+' '+(count===1?singular:plural);
}
function Avatar({large=false}:{large?:boolean}) {
 return <span className={'arena-avatar'+(large?' arena-avatar--large':'')}><UserRound aria-hidden="true"/></span>;
}
function SectionBar({icon,children}:{icon:ReactNode;children:ReactNode}) {
 return <div className="arena-section-bar"><span aria-hidden="true">{icon}</span><strong>{children}</strong><span className="arena-section-sky" aria-hidden="true"/></div>;
}
function Board({title,rows,metric,userId,loading,error,refresh}:{title:string;rows:readonly BoardRow[];metric:Metric;userId?:string|null;loading:boolean;error:string|null;refresh:()=>void}) {
 const own=userId?rows.find(r=>r.user_id===userId):undefined;
 return <section className="arena-board arena-live-board" aria-label={'Echte Top 10: '+title} aria-busy={loading}>
  <h2 className="arena-board-title"><BarChart3 aria-hidden="true"/> TOP 10 · {title} <em>GLOBAL</em></h2>
  <div className="arena-board-head" aria-hidden="true"><span>#</span><span>SPIELER</span><span>DUELLE</span><span>WERT</span></div>
  {loading?<p className="arena-live-message" role="status">ERGEBNISSE LADEN …</p>:
   error?<div className="arena-live-message" role="alert"><p>{error}</p><button type="button" onClick={refresh}><RefreshCw size={15}/> NOCHMAL</button></div>:
   rows.length===0?<p className="arena-live-message" role="status">Noch keine freigegebenen Ergebnisse in dieser Wertung.</p>:
   <ol className="arena-board-list">{rows.slice(0,10).map(row=>
    <li key={row.user_id} className={'arena-board-row'+(row.rank_position===1?' is-first':'')+(row.user_id===userId?' is-current':'')}>
     <span className="arena-board-rank">{row.rank_position===1?<Crown aria-label="Platz 1"/>:'#'+row.rank_position}</span>
     <Avatar/><strong className="arena-board-name" title={row.username}>{row.username}{row.user_id===userId?' · DU':''}</strong>
     <span className="arena-board-level">{row.races_count}</span>
     <strong className="arena-board-value">{valueText(row.value,metric)}</strong>
    </li>)}</ol>}
  {!loading&&!error&&own&&own.rank_position>10&&<div className="arena-own-overflow">DEIN RANG <b>#{own.rank_position}</b> · {valueText(own.value,metric)}</div>}
 </section>;
}

export default function LeaderboardScreen({userId,displayName}:{userId?:string|null;displayName?:string|null}) {
 const location = useLocation();
 const [tab,setTab]=useState<PageTab>(() => new URLSearchParams(location.search).get('tab') === 'records' ? 'records' : 'rivals');
 const [metric,setMetric]=useState<Metric>('times');
 const [distance,setDistance]=useState<Distance>(50);
 const [rows,setRows]=useState<BoardRow[]>([]);
 const [consent,setConsent]=useState<boolean|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [revision,setRevision]=useState(0);
 const contentRef=useRef<HTMLDivElement>(null);
 const history=useRunnerHistory(userId);
 const rivals=useMemo(()=>summarizeRivals(history.races),[history.races]);
 const finished=useMemo(()=>history.races.filter(r=>r.completed).slice(0,5),[history.races]);
 const currentName=displayName?.trim()||'DU';
 const refresh=useCallback(()=>setRevision(n=>n+1),[]);
 const resetScroll=()=>{if(contentRef.current)contentRef.current.scrollTop=0;};

 useEffect(()=>{
  if(tab==='rivals'){setLoading(false);setError(null);return;}
  let active=true;setLoading(true);setError(null);setRows([]);
  async function load(){
   try {
    const response=tab==='ladder'
     ?await supabase.rpc('list_beta_duel_leaderboard',{p_target_distance_m:null,p_limit:100})
     :await supabase.rpc('list_beta_runnit_records',{p_metric:metric,p_distance_m:distance,p_limit:100});
    if(response.error)throw response.error;
    const normalized:BoardRow[]=tab==='ladder'
      ?((response.data??[]) as PublicRow[]).map(r=>({rank_position:r.rank_position,user_id:r.user_id,username:r.username,value:r.wins_count,races_count:r.races_count,wins_count:r.wins_count}))
      :((response.data??[]) as RecordRow[]).filter(r=>r.metric_value!==null).map(r=>({rank_position:r.rank_position,user_id:r.user_id,username:r.username,value:r.metric_value!,races_count:r.races_count,wins_count:r.wins_count}));
    if(active){setRows(normalized);setLoading(false);}
   }catch{if(active){setError('Wertung konnte nicht geladen werden.');setLoading(false);}}
  }
  void load();return()=>{active=false;};
 },[tab,metric,distance,revision]);
 useEffect(()=>{
  if(!userId){setConsent(null);return;}
  let active=true;
  void supabase.from('users').select('leaderboard_opt_in').eq('id',userId).maybeSingle()
   .then(({data,error})=>{if(active)setConsent(error?null:data?.leaderboard_opt_in===true);});
  return()=>{active=false;};
 },[userId,revision]);
 useEffect(()=>{
  const focus=()=>{if(document.visibilityState==='visible')refresh();};
  window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  return()=>{window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
 },[refresh]);

 const selectTab=(next:PageTab)=>{setTab(next);resetScroll();};
 const onKey=(e:KeyboardEvent<HTMLButtonElement>,i:number)=>{
  const index=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:-1;
  if(index<0)return;e.preventDefault();selectTab(tabs[index].id);
  e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
 };
 const rival=rivals[0],champ=rows[0];

 return <main className="arena-screen runnit-competition runnit-legends" aria-label="RUNNIT Legends">
  <div className="arena-stage">
   <header className="arena-hero" aria-label="RUNNIT LEGENDS">
    <img className="legends-hero-image" src="/runnit-legends-hero.webp" alt="" aria-hidden="true" width={708} height={440} fetchPriority="high"/>
    <span className="legends-hero-crown" aria-hidden="true"><Crown /></span>
    <h1>LEGENDS</h1>
    <p className="arena-hero-bottom"><span>RIVALEN</span> · <b>WERTUNG</b> · <em>REKORDE</em></p>
   </header>
   <nav className="arena-tabs" role="tablist" aria-label="Ranglistenbereiche">
    {tabs.map(({id,label,Icon},i)=><button key={id} role="tab" id={'competition-tab-'+id}
      type="button" aria-selected={tab===id} aria-controls="competition-panel"
      tabIndex={tab===id?0:-1} className={tab===id?'is-active':''}
      onClick={()=>selectTab(id)} onKeyDown={e=>onKey(e,i)}><Icon aria-hidden="true"/><span>{label}</span></button>)}
   </nav>
   <div ref={contentRef} className="arena-content" role="tabpanel" id="competition-panel" aria-labelledby={'competition-tab-'+tab}>
    {tab==='rivals'?<div className="arena-rivals arena-panel-area">
     <SectionBar icon={<Swords/>}>RIVALEN <em>// 1V1</em></SectionBar>
     {!userId?<div className="arena-live-message"><Users size={30}/>
       <p>Melde dich an, um echte Rivalen und eure Duellbilanz zu sehen.</p>
       <Link to="/login?next=%2Fleaderboard">ANMELDEN <ArrowRight size={16}/></Link></div>:
      history.loading?<div role="status" className="arena-live-message">DUELLE LADEN …</div>:
      history.error?<div role="alert" className="arena-live-message">{history.error}<button onClick={history.refresh} type="button">NOCHMAL</button></div>:
      <>
       <section className="arena-showdown" aria-label="Deine meistgespielte Rivalität">
        <img className="legends-showdown-art legends-showdown-art--left" src="/runnit-legends-duel-left.webp" width={360} height={145} alt="" aria-hidden="true"/>
        <img className="legends-showdown-art legends-showdown-art--right" src="/runnit-legends-duel-right.webp" width={360} height={145} alt="" aria-hidden="true"/>
        {rival?<div className="arena-showdown-people">
         <div className="arena-showdown-person"><Avatar large/><strong>{currentName}</strong><span>{countLabel(rival.wins,'SIEG','SIEGE')}</span></div>
         <div className="arena-versus"><strong>VS</strong><small>DUELL-BILANZ</small><b>{rival.wins} : {rival.losses}</b></div>
         <div className="arena-showdown-person"><Avatar large/><strong>{rival.name}</strong><span>{countLabel(rival.losses,'SIEG','SIEGE')}</span></div>
        </div>:<div className="arena-rivals-empty">Noch keine vollständig gespeicherten Duelle gegen andere Spieler.</div>}
        <Link className="arena-rematch" to="/map">» NEUES DUELL</Link>
       </section>
       <div className="arena-duel-grid">
        <section className="arena-duel-panel"><h2><Users aria-hidden="true"/> DEINE RIVALEN</h2>
         {rivals.length?rivals.slice(0,5).map(r=>
          <div key={r.userId} className="arena-mini-row"><Avatar/><span title={r.name}>{r.name}</span><b>{r.wins}:{r.losses}</b></div>
         ):<p className="arena-mini-empty">Keine Rivalen erfasst.</p>}
        </section>
        <section className="arena-duel-panel arena-duel-panel--magenta"><h2><Trophy aria-hidden="true"/> LETZTE DUELLE</h2>
         {finished.length?finished.map(r=>
          <div key={r.id} className="arena-mini-row">
           <span title={r.opponentName||'Runner'}>{r.opponentName||'RUNNER'}</span>
           <b>{r.outcome==='won'?'SIEG':r.outcome==='lost'?'NIED.':'REMIS'}</b>
          </div>):<p className="arena-mini-empty">Noch keine Ergebnisse.</p>}
        </section>
       </div>
       <div className="arena-self-strip" aria-label="Gespeicherte Duellbilanz">
        <span className="legends-summary"><strong>{history.totals.completedDuels}</strong><small>DUELLE</small></span>
        <span className="legends-summary"><strong>{history.totals.wins}</strong><small>SIEGE</small></span>
        <span className="legends-summary"><strong>{history.totals.losses}</strong><small>NIED.</small></span>
       </div>
      </>}
    </div>:tab==='ladder'?<div className="arena-ladder arena-panel-area">
     <SectionBar icon={<BarChart3/>}>RANGLISTE <em>// SIEGE</em></SectionBar>
     <p className="arena-scope-note">GLOBAL · FREIGEGEBENE ERGEBNISSE</p>
     <div className="arena-ladder-grid">
      <Board title="DUELLSIEGE" rows={rows} metric="wins" userId={userId} loading={loading} error={error} refresh={refresh}/>
      <aside className="arena-live-personal" aria-label="Deine Wettkampfbilanz">
       <UserRound size={18} aria-hidden="true"/><strong>{userId?currentName:'GAST'}</strong>
       <span>{userId?(countLabel(history.totals.wins,'SIEG','SIEGE')+' · '+countLabel(history.totals.completedDuels,'DUELL','DUELLE')):'ANMELDEN FÜR DEINE BILANZ'}</span>
       {userId&&consent===true&&rows.some(r=>r.user_id===userId)&&<b>RANG #{rows.find(r=>r.user_id===userId)?.rank_position}</b>}
       {userId&&consent===false&&<Link to="/profile">RANGLISTE FREIGEBEN ›</Link>}
      </aside>
     </div>
    </div>:<div className="arena-legends arena-panel-area">
     <SectionBar icon={<Trophy/>}>REKORDE <em>// BETA</em></SectionBar>
     <div className="arena-metrics" role="group" aria-label="Rekordkategorie">
      {metrics.map(({id,label,Icon})=><button type="button" key={id}
       aria-pressed={metric===id} className={'arena-metric'+(metric===id?' is-active':'')}
       onClick={()=>{setMetric(id);resetScroll();}}><Icon aria-hidden="true"/><span>{label}</span></button>)}
     </div>
     <div className="arena-champion" aria-label="Bester öffentlich freigegebener Datensatz">
      {metric==='times'&&<div className="arena-distance" role="group" aria-label="Renndistanz">
       {([50,75,100] as const).map(d=><button key={d} type="button" aria-pressed={distance===d}
        className={distance===d?'is-active':''} onClick={()=>{setDistance(d);resetScroll();}}>{d} M</button>)}
      </div>}
      <div className="arena-champion-main">
       <div className="arena-champion-avatar"><Crown aria-hidden="true"/><Avatar large/></div>
       <div className="arena-champion-name"><strong>{loading?'WIRD GELADEN':champ?.username||'NOCH OFFEN'}</strong><span>{metricLabel(metric)}</span></div>
       <strong className="arena-champion-score">{!loading&&champ?valueText(champ.value,metric):'—'}</strong>
      </div>
     </div>
     <Board title={metricLabel(metric)+(metric==='times'?' · '+distance+' M':'')}
      rows={rows} metric={metric} userId={userId} loading={loading} error={error} refresh={refresh}/>
    </div>}
   </div>
   <div className="arena-beta-note" role="note"><ShieldAlert size={12} aria-hidden="true"/>
    BETA · DUELLE · NOCH NICHT MANIPULATIONSSICHER
   </div>
  </div>
  <BottomNav/>
 </main>;
}
