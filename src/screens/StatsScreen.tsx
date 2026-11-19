import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, CalendarDays, Check, Flag, Footprints, Gauge, MapPin,
  RefreshCw, Route, ShieldCheck, Target, Timer, Trophy, Zap
} from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import { useRunnerHistory } from '../hooks/useRunnerHistory';
import { useStatsGoal } from '../hooks/useStatsGoal';
import {
  calculateStatsOverview, clampProgress, formatStatsDistance, formatStatsTime
} from '../lib/statsDashboard';
import '../styles/statsPerformance.css';

type Props = { userId?: string | null };
const goals = [1000,3000,5000,10000] as const;

function Headline({children,detail,id}: {children:React.ReactNode,detail?:string,id?:string}){
  return <div className="stats-v2-section-head"><span aria-hidden="true" className="stats-v2-stripes">///</span><h2 id={id}>{children}</h2>{detail&&<span className="stats-v2-head-detail">{detail}</span>}</div>;
}
function StatTile({icon:Icon,label,value,foot}:{
 icon:typeof Footprints;label:string;value:string;foot:string
}){
 return <div className="stats-v2-tile">
   <Icon className="stats-v2-tile-icon" aria-hidden="true"/>
   <div><span className="stats-v2-tile-label">{label}</span>
    <strong className="stats-v2-tile-value">{value}</strong>
    <small>{foot}</small></div>
 </div>;
}

function ActivityChart({days,active}:{
 days:{key:string;label:string;sessions:number}[];active:boolean
}){
 const high=Math.max(1,...days.map(d=>d.sessions));
 return <div className="stats-v2-chart" role="img"
     aria-label={'Abgeschlossene Läufe je Wochentag: '+days.map(d=>d.label+': '+d.sessions).join(', ')}>
   <div className="stats-v2-chart-lines" aria-hidden="true"><i/><i/><i/><i/></div>
   <div className="stats-v2-bars" aria-hidden="true">
    {days.map(d=><div className="stats-v2-bar-slot" key={d.key}>
      <div className="stats-v2-bar-track">
        <div className={'stats-v2-bar-fill'+(d.sessions===high && d.sessions>0?' is-peak':'')}
          style={{'--bar-height':d.sessions?Math.max(9,Math.round(d.sessions/high*100))+'%':'0%'} as CSSProperties}>
          {d.sessions>0&&<span className="stats-v2-bar-label">{d.sessions}</span>}
        </div>
      </div>
      <strong>{d.label}</strong>
    </div>)}
   </div>
 </div>;
}

function SpeedGauge({fraction,active,measured}:{
 fraction:number;active:boolean;measured:boolean
}){
 const progress=clampProgress(fraction);
 const radius=77, circumference=2*Math.PI*radius;
 const degrees=-115+230*progress;
 return <div className="stats-v2-speed" role="img"
   aria-label={measured?'Wochenziel zu '+Math.round(progress*100)+' Prozent erreicht':'Für diesen Zeitraum ist noch keine Strecke aufgezeichnet'}>
   <svg viewBox="0 0 220 220" className="stats-v2-speed-svg" aria-hidden="true">
     <defs>
       <linearGradient id="statsGaugeStroke" x1="0" y1="1" x2="1" y2="0">
         <stop offset="0" stopColor="#1df5ff"/><stop offset=".53" stopColor="#1ef2ed"/>
         <stop offset=".62" stopColor="#c5ff00"/><stop offset="1" stopColor="#e3ff13"/>
       </linearGradient>
       <filter id="statsGaugeGlow"><feGaussianBlur stdDeviation="3"/></filter>
     </defs>
     {Array.from({length:11},(_,i)=><line key={i} x1="110" y1="8" x2="110" y2="20"
       transform={'rotate('+(-115+i*23)+' 110 110)'} stroke="#70c9e1" strokeWidth="2" opacity=".55"/>)}
     <circle cx="110" cy="110" r={radius} className="stats-v2-speed-track"/>
     <circle cx="110" cy="110" r={radius} className="stats-v2-speed-progress-glow"
       strokeDasharray={circumference} strokeDashoffset={active?circumference*(1-progress):circumference}/>
     <circle cx="110" cy="110" r={radius} className="stats-v2-speed-progress"
       strokeDasharray={circumference} strokeDashoffset={active?circumference*(1-progress):circumference}/>
     <g className="stats-v2-speed-needle" style={{transform:'rotate('+(active?degrees:-115)+'deg)'}}>
       <path d="M106 113L110 44L114 113Z" fill="#d4ff10" stroke="#efff8e" strokeWidth="1"/>
       <circle cx="110" cy="110" r="7" fill="#d6ff14" stroke="#fff" strokeWidth="1"/>
     </g>
   </svg>
   <div className="stats-v2-speed-center" aria-hidden="true">
     <Zap size={19}/><strong>{measured?Math.round(progress*100)+'%':'—'}</strong>
     <span>WOCHENZIEL</span>
   </div>
 </div>;
}

export default function StatsScreen({userId}:Props) {
 const {races,ghostSessions,totals,loading,error,refresh}=useRunnerHistory(userId);
 const goal=useStatsGoal(userId);
 const [goalDraft,setGoalDraft]=useState(goal.goalM);
 const [saved,setSaved]=useState(false);
 const [active,setActive]=useState(false);
 const stats=useMemo(()=>calculateStatsOverview(races,ghostSessions),[races,ghostSessions]);
 useEffect(()=>setGoalDraft(goal.goalM),[goal.goalM]);
 useEffect(()=>{
   setActive(false);
   if(!userId || loading || error)return;
   const frame=requestAnimationFrame(()=>setActive(true));
   return()=>cancelAnimationFrame(frame);
 },[userId,loading,error]);
 const progress=stats.weeklyMeasuredDistanceM===null?0:stats.weeklyMeasuredDistanceM/goal.goalM;
 const entries=useMemo(()=>[
   ...races.map(r=>({id:'d-'+r.id,at:r.occurredAt,
     title:'1V1 · '+r.distanceM+' M',time:formatStatsTime(r.timeMs),
     sub:r.completed?r.outcome==='won'?'DUELL GEWONNEN':r.outcome==='lost'?'DUELL VERLOREN':r.outcome==='tie'?'REMIS':'ERGEBNIS GESPEICHERT':'DUELL NICHT ABGESCHLOSSEN'})),
   ...ghostSessions.map(g=>({id:'g-'+g.id,at:g.created_at,
     title:'GHOST · '+g.target_distance_m+' M',time:formatStatsTime(g.elapsed_ms),
     sub:g.run_state==='finished'?'SOLO-TRAINING · ABGESCHLOSSEN':'TRAINING ABGEBROCHEN'})),
 ].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,12),[races,ghostSessions]);
 const soloSessions=ghostSessions.filter(g=>g.run_state==='finished' && typeof g.elapsed_ms==='number' && g.elapsed_ms>0);
 const soloDistance=soloSessions.length?soloSessions.reduce((n,g)=>n+(Number.isFinite(g.observed_distance_m)&&g.observed_distance_m>=0?g.observed_distance_m:0),0):null;
 const winRate=stats.completedDuels?Math.round(stats.wins/stats.completedDuels*100):null;
 const saveGoal=async()=>{
   setSaved(false);
   if(await goal.save(goalDraft)){setSaved(true);}
 };

 return <main className="runnit-game-home runnit-stats-screen runnit-stats-v2 text-white">
   <div className="stats-v2-scene" aria-hidden="true"/>
   <div className="stats-v2-stage" data-active={active?'true':'false'}>
     <header className="stats-v2-hero">
       <div className="stats-v2-brand">RUNNIT <span aria-hidden="true">≡</span></div>
       <h1>DEINE <em>STATS.</em></h1>
       <p className="stats-v2-kicker">DEIN PROTOKOLL · SERVERGESPEICHERT</p>
       <p className="stats-v2-intro">Deine Läufe, Bestzeiten und Trainingsdaten – direkt aus deinem RUNNIT-Konto.</p>
     </header>

     {!userId ? <section className="stats-v2-panel stats-v2-login" role="status">
       <Headline>DEIN <em>PROTOKOLL</em></Headline>
       <p>Melde dich an, um deine gespeicherten Ergebnisse und Ziele zu sehen.</p>
       <Link className="stats-v2-link" to="/login?next=%2Fstats">ANMELDEN <ArrowRight size={17}/></Link>
     </section>:
     <>
      {(error||goal.error)&&<div role="alert" className="stats-v2-error">
       <span>{error||goal.error}</span>
       <button type="button" onClick={()=>{refresh();goal.refresh();}}><RefreshCw size={15}/> ERNEUT LADEN</button>
      </div>}
      {(loading||goal.loading)&&<div role="status" className="stats-v2-panel stats-v2-loading">
        <Activity size={19}/> DEINE DATEN WERDEN GELADEN …
      </div>}
      {!loading&&!error&&<>
       <section className="stats-v2-panel" aria-labelledby="stats-week">
         <Headline id="stats-week" detail="NUR RUNNIT-LÄUFE">DIESE <em>WOCHE</em></Headline>
         <div className="stats-v2-week-tiles">
           <StatTile icon={Footprints} label="LÄUFE" value={String(totals.weeklySessions)} foot="abgeschlossen"/>
           <StatTile icon={Activity} label="SCHRITTE" value={totals.weeklySteps===null?'—':totals.weeklySteps.toLocaleString('de-DE')} foot="aufgezeichnet"/>
           <StatTile icon={Route} label="STRECKE" value={formatStatsDistance(totals.weeklyDistanceM)} foot="gemessen"/>
         </div>
       </section>

       <section className="stats-v2-panel" aria-labelledby="stats-activity">
         <Headline id="stats-activity" detail="LÄUFE PRO TAG">AKTIVITÄT</Headline>
         <ActivityChart days={stats.days} active={active}/>
       </section>

       <section className="stats-v2-panel" aria-labelledby="stats-duel">
         <Headline id="stats-duel">DUELLE <em>VS</em> SOLO</Headline>
         <div className="stats-v2-compare">
           <div className="stats-v2-compare-card">
             <h3><Flag size={22}/> DUELLE</h3>
             <div className="stats-v2-compare-values">
               <div><strong>{stats.completedDuels}</strong><small>DUELLE</small></div>
               <div><strong>{stats.wins}</strong><small>SIEGE</small></div>
               <div><strong>{stats.losses}</strong><small>NIED.</small></div>
               <div><strong>{winRate===null?'—':winRate+'%'}</strong><small>SIEGQUOTE</small></div>
             </div>
           </div>
           <div className="stats-v2-compare-card stats-v2-compare-card--solo">
             <h3><Footprints size={22}/> SOLO</h3>
             <div className="stats-v2-compare-values">
               <div><strong>{stats.soloTrainings}</strong><small>TRAININGS</small></div>
               <div><strong>{stats.ghostTrainings}</strong><small>GHOST</small></div>
               <div className="stats-v2-span-two"><strong>{formatStatsDistance(soloDistance)}</strong><small>SOLO-STRECKE</small></div>
             </div>
           </div>
         </div>
         <p className="stats-v2-caption">Ghost-Runs zählen als Solo-Trainings, nicht zusätzlich als Duelle. Remis: {stats.ties}.</p>
       </section>

       <section className="stats-v2-panel" aria-labelledby="stats-records">
         <Headline id="stats-records">PERSÖNLICHE BESTZEITEN</Headline>
         <div className="stats-v2-record-grid">
           {([50,75,100] as const).map(d=><div className="stats-v2-record" key={d}>
             <span>{d} m</span><strong>{formatStatsTime(stats.bestTimes[d])}</strong>
           </div>)}
           <div className="stats-v2-record is-future"><span>1 km</span><strong>—</strong></div>
         </div>
         <p className="stats-v2-caption">Bestzeiten aus abgeschlossenen, beidseitig erfassten Duellen. 1 km ist noch nicht verfügbar.</p>
       </section>

       <section className="stats-v2-panel stats-v2-form" aria-labelledby="stats-form">
         <Headline id="stats-form">AKTUELLE <em>FORM</em></Headline>
         <div className="stats-v2-form-body">
           <SpeedGauge fraction={progress} active={active} measured={stats.weeklyMeasuredDistanceM!==null}/>
           <div className="stats-v2-form-info">
             <div className="stats-v2-form-line"><CalendarDays aria-hidden="true"/><div><span>AKTIVE TAGE · DIESE WOCHE</span><strong>{stats.activeDaysThisWeek} TAGE</strong></div></div>
             <div className="stats-v2-form-line"><Zap aria-hidden="true"/><div><span>LAUF-SERIE</span><strong>{stats.currentStreak} TAGE AM STÜCK</strong></div></div>
             <div className="stats-v2-goal-copy"><Target aria-hidden="true"/><div><span>WOCHENZIEL</span><strong>{formatStatsDistance(stats.weeklyMeasuredDistanceM)} / {formatStatsDistance(goal.goalM)}</strong></div></div>
             <div className="stats-v2-progress" role="progressbar" aria-valuemin={0} aria-valuemax={goal.goalM}
               aria-valuenow={Math.min(goal.goalM,stats.weeklyMeasuredDistanceM??0)}
               aria-label="Fortschritt zum persönlichen Wochenziel">
               <span style={{transform:'scaleX('+(active?clampProgress(progress):0)+')'}}/>
             </div>
           </div>
         </div>
         <div className="stats-v2-goal-controls">
           <label htmlFor="stats-goal-select">WOCHENZIEL ANPASSEN</label>
           <select id="stats-goal-select" value={goalDraft} disabled={goal.saving||goal.loading}
             onChange={e=>{setGoalDraft(Number(e.target.value));setSaved(false);}}>
             {goals.map(m=><option key={m} value={m}>{(m/1000).toLocaleString('de-DE')} km</option>)}
           </select>
           <button type="button" disabled={goal.saving||goal.loading||goalDraft===goal.goalM} onClick={saveGoal}>
             {goal.saving?'SPEICHERT …':saved?'GESPEICHERT':'SPEICHERN'} {saved?<Check size={15}/>:null}
           </button>
         </div>
         <p className="stats-v2-caption">Dein Ziel wird in Supabase gespeichert. Der Tacho zählt bei jedem Öffnen neu hoch.</p>
       </section>

       <section className="stats-v2-panel stats-v2-history" aria-labelledby="stats-history">
         <Headline id="stats-history" detail={entries.length+' EINTRÄGE'}>LETZTE <em>LÄUFE</em></Headline>
         {entries.length===0?<p className="stats-v2-caption">Noch keine abgeschlossenen Läufe gespeichert.</p>:
         <ol>{entries.map(e=><li key={e.id}><span><strong>{e.title}</strong><small>{e.sub} · {Number.isFinite(Date.parse(e.at))?new Date(e.at).toLocaleDateString('de-DE'):''}</small></span><b>{e.time}</b></li>)}</ol>}
       </section>
       <p className="stats-v2-safety"><ShieldCheck aria-hidden="true" size={18}/>
         Die Anzeige basiert auf gespeicherten Beta-Renndaten. GPS-/IMU-Messungen sind noch nicht unabhängig manipulationssicher.
       </p>
      </>}
     </>}
     <Link to="/map" className="stats-v2-next"><Gauge size={20}/> ZUM NÄCHSTEN LAUF <ArrowRight size={19}/></Link>
   </div>
   <BottomNav/>
 </main>;
}
