import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {nativeProbeForWindow,type ProbeReport} from '../lib/nativeSensorProbe';

export default function NativeSensorScreen(){
 const api=useRef<ReturnType<typeof nativeProbeForWindow>>(null);
 const generation=useRef(0);
 const run=useRef<string|null>(null);
 const starting=useRef(false);
 const [busy,setBusy]=useState(false);
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
   if(!id||!bridge||reading)return;
   reading=true;
   void bridge.read(id).then(value=>{
    if(ticket!==generation.current||id!==run.current)return;
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
  starting.current=true;setBusy(true);setReport(null);
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
 return <main className="min-h-[100dvh] bg-[#080b13] px-4 py-8 text-white">
  <div className="mx-auto max-w-xl space-y-5">
   <Link to="/gps-field-test" className="text-sm text-cyan-200 underline">Zurück zum GPS-Feldtest</Link>
   <h1 className="text-3xl font-black">Native Sensor-Diagnose</h1>
   <p className="text-sm leading-6 text-white/75">Core Location und Core Motion · 30 Sekunden · nur im Vordergrund. Keine Koordinaten, Rohmesswerte oder Ergebnisse werden an den Server gesendet. Kein echter Sprinttest.</p>
   <button type="button" disabled={busy||Boolean(run.current)} onClick={()=>{void start();}} className="min-h-14 w-full rounded-xl bg-cyan-400 font-bold text-slate-950 disabled:opacity-50">Sensortest starten</button>
   <button type="button" disabled={!report||report.status!=='running'} onClick={()=>{void stop();}} className="min-h-12 w-full rounded-xl border border-white/25 disabled:opacity-50">Beenden</button>
   <p role="status" className="text-sm text-white/75">{notice}</p>
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
