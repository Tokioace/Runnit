import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {nativeProbeForWindow,nativeReferenceDifference,nativeStepDifference,type ProbeReport} from '../lib/nativeSensorProbe';

export default function NativeSensorScreen(){
 const api=useRef<ReturnType<typeof nativeProbeForWindow>>(null);
 const generation=useRef(0);
 const run=useRef<string|null>(null);
 const starting=useRef(false);
 const [busy,setBusy]=useState(false);
 const [target,setTarget]=useState<50|75|100>(50);
 const [reference,setReference]=useState('');
 const [manualSteps,setManualSteps]=useState('');
 const arming=useRef(false);
 const [armBusy,setArmBusy]=useState(false);
 const [report,setReport]=useState<ProbeReport|null>(null);
 const [notice,setNotice]=useState('Bereit für einen lokalen 30-Sekunden-Sensortest.');
 const stop=async ()=>{
  const ticket=++generation.current;
  const id=run.current;run.current=null;
  if(id&&api.current){
   try{const result=await api.current.stop(id);if(ticket===generation.current)setReport(result);}
   catch{if(ticket===generation.current)setNotice('Stopp nicht bestätigt. Die native Zeitbegrenzung bleibt aktiv.');}
  }
 };
 useEffect(()=>{
  api.current=nativeProbeForWindow();
  const hide=()=>{if(document.hidden){void stop();}};
  const leave=()=>{void stop();};
  document.addEventListener('visibilitychange',hide);
  window.addEventListener('pagehide',leave);
  let reading=false;
  const timer=window.setInterval(()=>{
   const id=run.current;const ticket=generation.current;const bridge=api.current;
   if(!id||!bridge||reading||arming.current)return;
   reading=true;
   void bridge.read(id).then(value=>{
    if(ticket!==generation.current||id!==run.current||arming.current)return;
    setReport(value);
    if(value.status!=='running'){run.current=null;setNotice('Messung beendet: '+value.status);}
   }).catch(()=>{
    if(ticket===generation.current&&id===run.current){setNotice('Sensorverbindung unterbrochen.');void stop();}
   }).finally(()=>{reading=false;});
  },500);
  return ()=>{
   ++generation.current;
   const id=run.current;run.current=null;
   if(id&&api.current)void api.current.stop(id).catch(()=>{});
   window.clearInterval(timer);document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',leave);
  };
 },[]);
 const start=async ()=>{
  const bridge=api.current;
  if(!bridge){setNotice('Native Sensorschnittstelle nicht verfügbar.');return;}
  if(starting.current||run.current||document.hidden)return;
  starting.current=true;setBusy(true);setReport(null);setReference('');setManualSteps('');
  const ticket=++generation.current;
  try{
   const result=await bridge.start();
   if(ticket!==generation.current||document.hidden){
    if(typeof result!=='string')void bridge.stop(result.runId).catch(()=>{});
    return;
   }
   if(typeof result==='string'){
    setNotice(result==='permission-requested'?'Standortberechtigung bestätigen und erneut starten.':'Standortzugriff verweigert. Bitte iOS-Einstellungen prüfen.');return;
   }
   run.current=result.status==='running'?result.runId:null;setReport(result);
   setNotice('Messung läuft. Kein Upload, keine Ranglistenwertung.');
  }catch{if(ticket===generation.current)setNotice('Sensoren konnten nicht gestartet werden.');}
  finally{starting.current=false;if(ticket===generation.current)setBusy(false);else if(!document.hidden)setBusy(false);}
 };
 const arm=async ()=>{
  const id=run.current,bridge=api.current,ticket=generation.current;
  if(!id||!bridge||arming.current||document.hidden)return;
  arming.current=true;setArmBusy(true);
  try{
   const result=await bridge.arm(id,target);
   if(ticket!==generation.current||id!==run.current)return;
   setReport(result);setNotice('Testlauf gestartet. Gerade Strecke, Display nicht während des Laufens beachten.');
  }catch{if(ticket===generation.current)setNotice('Start nicht möglich: frisches GPS-Signal und mindestens 15 s Restzeit erforderlich.');}
  finally{arming.current=false;setArmBusy(false);}
 };
 const sprint=report?.sprint;
 const analysis=report?.motionAnalysis;
 const stepDifference=analysis?nativeStepDifference(analysis.candidates,manualSteps):null;
 const difference=nativeReferenceDifference(sprint?.finishMs??null,reference);
 return <main className="min-h-[100dvh] bg-[#080b13] px-4 py-8 text-white">
  <div className="mx-auto max-w-xl space-y-5">
   <Link to="/gps-field-test" className="text-sm text-cyan-200 underline">Zurück zum GPS-Feldtest</Link>
   <h1 className="text-3xl font-black">Native Sensor-Diagnose</h1>
   <p className="text-sm leading-6 text-white/75">Core Location und Core Motion · 30 Sekunden · nur im Vordergrund. Keine Koordinaten, Rohmesswerte oder Ergebnisse werden an den Server gesendet. Experimenteller Test, keine Ranglistenwertung. Für die Zeitmessung eine sichere, gerade und abgemessene Strecke verwenden.</p>
   <button type="button" disabled={busy||Boolean(run.current)} onClick={()=>{void start();}} className="min-h-14 w-full rounded-xl bg-cyan-400 font-bold text-slate-950 disabled:opacity-50">Sensortest starten</button>
   <button type="button" disabled={!report||report.status!=='running'} onClick={()=>{void stop();}} className="min-h-12 w-full rounded-xl border border-white/25 disabled:opacity-50">Beenden</button>
   <p role="status" className="text-sm text-white/75">{notice}</p>
   {report?.status==='running'&&!sprint&&<section className="space-y-3 rounded-xl border border-white/15 p-4">
    <label htmlFor="native-target">Abgemessene Teststrecke</label>
    <select id="native-target" className="w-full rounded-lg bg-[#141b2a] p-3" value={target}
     disabled={armBusy} onChange={e=>setTarget(Number(e.target.value) as 50|75|100)}>
     <option value={50}>50 m</option><option value={75}>75 m</option><option value={100}>100 m</option>
    </select>
    <p className="text-xs text-white/60">Am Startpunkt stillstehen. Innerhalb der ersten 15 s starten, sobald ein frischer Fix vorliegt. Bis hinter die Ziellinie laufen. Nicht aufs Display schauen.</p>
    <button type="button" disabled={armBusy||report.accuracyM===null||report.accuracyM>15||report.elapsedMs>15000}
     onClick={()=>{void arm();}} className="min-h-12 w-full rounded-xl bg-emerald-400 font-bold text-slate-950 disabled:opacity-50">Testlauf starten</button>
   </section>}
   {sprint&&<section className="space-y-3 rounded-xl border border-white/15 p-4">
    <h2 className="font-bold">Experimenteller {sprint.targetM}-m-Test</h2>
    <p>Luftlinie: {sprint.distanceM.toFixed(1)} m · {sprint.accepted} akzeptiert / {sprint.rejected} verworfen</p>
    <p>{sprint.invalid?'Messung ungültig – erneuter Test nötig.':sprint.finishMs===null?'Keine bestätigte Zielzeit.':'GPS-Zielzeit: '+(sprint.finishMs/1000).toFixed(3)+' s'}</p>
    {sprint.finishMs!==null&&<div className="space-y-2">
     <label htmlFor="native-reference">Unabhängige Referenzzeit in Sekunden</label>
     <input id="native-reference" inputMode="decimal" autoComplete="off" className="w-full rounded-lg bg-[#141b2a] p-3" value={reference} onChange={e=>setReference(e.target.value)} placeholder="7,24"/>
     <p>{difference===null?'Keine auswertbare Referenzzeit.':'GPS minus Referenz: '+(difference>=0?'+':'')+difference.toFixed(3)+' s'}</p>
     <p className="text-xs text-white/60">Gleicher manueller Start und gleiche markierte Ziellinie. GPS-Schätzung, kein offizielles Ergebnis.</p>
    </div>}
   </section>}
   {analysis&&<section className="space-y-3 rounded-xl border border-white/15 p-4">
    <h2 className="font-bold">Bewegungsanalyse · {analysis.window==='sprint'?'Sprintfenster':'Gesamttest'}</h2>
    <p>{analysis.candidates} Schrittkandidaten · {Math.round(analysis.coverage*100)} % Sensorabdeckung</p>
    <p>Kadenz: {analysis.cadenceSpm===null?'nicht bestimmbar':analysis.cadenceSpm.toFixed(1)+' Schritte/min (geschätzt)'}</p>
    <p className="text-xs text-white/60">{analysis.state==='sprint-like'?'Sprintähnlicher Rhythmus':analysis.state==='other-rhythm'?'Anderer regelmäßiger Rhythmus':analysis.state==='incomplete'?'Messabdeckung unzureichend':analysis.state==='irregular'?'Unregelmäßiger Rhythmus':'Zu wenige Bewegungsspitzen'} · keine verifizierten Schritte.</p>
    {report?.status!=='running'&&report?.status!=='interrupted'&&report?.status!=='sensor-error'&&(!sprint||sprint.finishMs!==null)&&<div className="space-y-2">
     <label htmlFor="native-step-reference">Manuell gezählte Schritte im gleichen Messfenster</label>
     <input id="native-step-reference" inputMode="numeric" autoComplete="off" className="w-full rounded-lg bg-[#141b2a] p-3" value={manualSteps} onChange={e=>setManualSteps(e.target.value)} placeholder="z. B. 25"/>
     <p>{stepDifference===null?'Keine Vergleichszahl.':'Kandidaten minus manuelle Zählung: '+(stepDifference>=0?'+':'')+stepDifference}</p>
    </div>}
   </section>}
   {report&&<dl className="grid grid-cols-2 gap-4 rounded-2xl border border-white/15 p-4">
    <div><dt>Messdauer</dt><dd>{(report.elapsedMs/1000).toFixed(1)} s</dd></div>
    <div><dt>GPS-Fixes</dt><dd>{report.gpsFixes}</dd></div>
    <div><dt>GPS-Genauigkeit</dt><dd>{report.accuracyM===null?'—':report.accuracyM.toFixed(1)+' m'}</dd></div>
    <div><dt>Verworfene Fixes</dt><dd>{report.rejectedFixes}</dd></div>
    <div><dt>Motion-Samples</dt><dd>{report.motionSamples}</dd></div>
    <div><dt>Motion-Lücken</dt><dd>{report.motionGaps}</dd></div>
    <div><dt>Motion verfügbar</dt><dd>{report.motionAvailable?'Ja':'Nein'}</dd></div>
    <div><dt>Ø Motion-Rate</dt><dd>{report.elapsedMs>0?(report.motionSamples*1000/report.elapsedMs).toFixed(1):'—'} Hz</dd></div>
   </dl>}
  </div>
 </main>;
}
