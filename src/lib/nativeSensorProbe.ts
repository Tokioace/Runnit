export type SprintProbeReport = Readonly<{targetM:50|75|100; distanceM:number; accepted:number; rejected:number; invalid:boolean; finishMs:number|null}>;
export type ProbeReport = Readonly<{
 runId:string; status:'running'|'completed'|'stopped'|'interrupted'|'sensor-error';
 elapsedMs:number; gpsFixes:number; rejectedFixes:number; accuracyM:number|null;
 motionSamples:number; motionGaps:number; motionAvailable:boolean;
 sprint?:SprintProbeReport;
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
 return {runId:r.runId,status:r.status as ProbeReport['status'],elapsedMs:r.elapsedMs,gpsFixes:r.gpsFixes,
    rejectedFixes:r.rejectedFixes,accuracyM:accuracy,motionSamples:r.motionSamples,
    motionGaps:r.motionGaps,motionAvailable:r.motionAvailable,...(sprint?{sprint}:{})};
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
