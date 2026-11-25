export type SprintProbeReport = Readonly<{targetM:50|75|100; distanceM:number; accepted:number; rejected:number; invalid:boolean; finishMs:number|null}>;
export type MotionProbeAnalysis = Readonly<{candidates:number; samples:number; gaps:number; coverage:number;
 cadenceSpm:number|null; state:'incomplete'|'insufficient'|'irregular'|'sprint-like'|'other-rhythm'; window:'probe'|'sprint'}>;
export type ProbeReport = Readonly<{
 runId:string; status:'running'|'completed'|'stopped'|'interrupted'|'sensor-error';
 elapsedMs:number; gpsFixes:number; rejectedFixes:number; accuracyM:number|null;
 motionSamples:number; motionGaps:number; motionAvailable:boolean;
 sprint?:SprintProbeReport;
 motionAnalysis?:MotionProbeAnalysis;
}>;
type Bridge={nativePromise(plugin:string,method:string,options:Record<string,string>):Promise<unknown>};
const states=['running','completed','stopped','interrupted','sensor-error'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const numberIn=(v:unknown,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
export function parseProbeReport(raw:unknown,expected?:string):ProbeReport|null{
 if(!raw||typeof raw!=='object')return null;
 const r=raw as Record<string,unknown>;
 if(typeof r.runId!=='string'||!uuid.test(r.runId)||(expected!==undefined&&r.runId!==expected)||
    typeof r.status!=='string'||!states.includes(r.status)||!numberIn(r.elapsedMs,30000)||
    typeof r.motionAvailable!=='boolean')return null;
 const count=(v:unknown):v is number=>numberIn(v,100000)&&Number.isInteger(v);
 if(!count(r.gpsFixes)||!count(r.rejectedFixes)||!count(r.motionSamples)||!count(r.motionGaps)||
    r.motionGaps>r.motionSamples)return null;
 const accuracy=r.accuracyM===null?null:numberIn(r.accuracyM,100000)?r.accuracyM:undefined;
 if(accuracy===undefined)return null;
 let sprint:SprintProbeReport|undefined;
 if(r.sprint!==undefined){
  if(!r.sprint||typeof r.sprint!=='object')return null;
  const s=r.sprint as Record<string,unknown>;
  const target=s.targetM;
  if((target!==50&&target!==75&&target!==100)||!numberIn(s.distanceM,1000)||!count(s.accepted)||!count(s.rejected)||typeof s.invalid!=='boolean')return null;
  let finishMs:number|null=null;
  if(s.finishMs!==null){
   if(!numberIn(s.finishMs,30000)||s.finishMs<=0||s.finishMs>r.elapsedMs+100||s.invalid||s.accepted<2||s.distanceM<target||r.status!=='completed')return null;
   finishMs=s.finishMs;
  }
  sprint={targetM:target,distanceM:s.distanceM,accepted:s.accepted,rejected:s.rejected,invalid:s.invalid,finishMs};
 }
 let motionAnalysis:MotionProbeAnalysis|undefined;
 if(r.motionAnalysis!==undefined){
  if(!r.motionAnalysis||typeof r.motionAnalysis!=='object')return null;
  const m=r.motionAnalysis as Record<string,unknown>;
  if(!count(m.candidates)||!count(m.samples)||!count(m.gaps)||m.samples>3000||
    m.samples>r.motionSamples||m.candidates>m.samples||m.gaps>m.samples||!numberIn(m.coverage,1)||
    (m.window!=='probe'&&m.window!=='sprint')||m.window!==(sprint?'sprint':'probe')||
    typeof m.state!=='string'||!['incomplete','insufficient','irregular','sprint-like','other-rhythm'].includes(m.state))return null;
  let cadenceSpm:number|null=null;
  const rhythmic=m.state==='sprint-like'||m.state==='other-rhythm';
  if(rhythmic){
    if(!numberIn(m.cadenceSpm,320)||m.cadenceSpm<=0||m.candidates<6||m.samples<10||m.gaps!==0||m.coverage<0.7)return null;
    if((m.cadenceSpm>=140&&m.cadenceSpm<=300)!==(m.state==='sprint-like'))return null;
    cadenceSpm=m.cadenceSpm;
  }else if(m.cadenceSpm!==null)return null;
  motionAnalysis={candidates:m.candidates,samples:m.samples,gaps:m.gaps,coverage:m.coverage,
   cadenceSpm,state:m.state as MotionProbeAnalysis['state'],window:m.window};
 }
 return {runId:r.runId,status:r.status as ProbeReport['status'],elapsedMs:r.elapsedMs,gpsFixes:r.gpsFixes,
    rejectedFixes:r.rejectedFixes,accuracyM:accuracy,motionSamples:r.motionSamples,
    motionGaps:r.motionGaps,motionAvailable:r.motionAvailable,...(sprint?{sprint}:{}),...(motionAnalysis?{motionAnalysis}:{})};
}
export function createNativeProbe(bridge:Bridge){
 const invoke=(method:string,options:Record<string,string>={})=>bridge.nativePromise('RunnitSensorProbe',method,options);
 const report=(raw:unknown,id?:string)=>{
  const parsed=parseProbeReport(raw,id);
  if(!parsed)throw new Error('Invalid sensor response');
  return parsed;
 };
 return {
  async start():Promise<ProbeReport|'permission-requested'|'permission-denied'>{
   const raw=await invoke('startProbe');
   if(raw&&typeof raw==='object'&&'status' in raw){
    if(raw.status==='permission-requested')return 'permission-requested';
    if(raw.status==='permission-denied')return 'permission-denied';
   }
   return report(raw);
  },
  async arm(id:string,target:50|75|100){if(!uuid.test(id)||![50,75,100].includes(target))throw new Error('Invalid sprint request');return report(await invoke('armSprint',{runId:id,targetM:String(target)}),id);},
  async read(id:string){if(!uuid.test(id))throw new Error('Invalid probe ID');return report(await invoke('readProbe',{runId:id}),id);},
  async stop(id:string){if(!uuid.test(id))throw new Error('Invalid probe ID');return report(await invoke('stopProbe',{runId:id}),id);},
 };
}
export function nativeProbeForWindow(){
 const cap=(window as Window & {Capacitor?:Partial<Bridge>}).Capacitor;
 return typeof cap?.nativePromise==='function'?createNativeProbe(cap as Bridge):null;
}

/** Reference must be from the same manual start / marked finish. Not a verification. */
export function nativeReferenceDifference(finishMs:number|null,reference:string):number|null {
 if(finishMs===null||!numberIn(finishMs,30000)||finishMs<=0||!/^\d{1,2}(?:[.,]\d{1,3})?$/.test(reference.trim()))return null;
 const seconds=Number(reference.trim().replace(',','.'));
 return seconds>0&&seconds<=30?finishMs/1000-seconds:null;
}

export function nativeStepDifference(candidates:number,reference:string):number|null {
 if(!Number.isInteger(candidates)||candidates<0||candidates>3000||!/^\d{1,3}$/.test(reference.trim()))return null;
 const counted=Number(reference.trim());
 return counted<=300?candidates-counted:null;
}
