import type { ProbeReport } from './nativeSensorProbe.ts';

export type NativeConsistency = Readonly<{
  status:'insufficient'|'discrepancy'|'compatible';
  reasons:readonly string[];
  averageSpeedMps:number|null;
  candidatesPerMinute:number|null;
  metersPerCandidate:number|null;
  verification:'unverified';
}>;

/** Experimental field-test heuristics, not a classifier trained on real runners.
 * No sanctions, server upload, ranking eligibility or verified claims. */
export function assessNativeConsistency(report:ProbeReport):NativeConsistency {
  const s=report.sprint,m=report.motionAnalysis;
  const result=(status:NativeConsistency['status'],reasons:string[],
    averageSpeedMps:number|null=null,candidatesPerMinute:number|null=null,
    metersPerCandidate:number|null=null):NativeConsistency=>({
      status,reasons,averageSpeedMps,candidatesPerMinute,metersPerCandidate,verification:'unverified'
    });
  if(report.status!=='completed'||!s||s.invalid||s.finishMs===null||
      !Number.isFinite(s.finishMs)||s.finishMs<=0||s.finishMs>30000||
      ![50,75,100].includes(s.targetM)||s.accepted<2||s.distanceM<s.targetM) {
    return result('insufficient',['no-completed-sprint']);
  }
  const seconds=s.finishMs/1000;
  const speed=s.targetM/seconds;
  if(!report.motionAvailable||!m||m.window!=='sprint'||
    !Number.isFinite(m.coverage)||m.coverage<0.7||m.gaps!==0||m.samples<10||
    m.state==='incomplete')return result('insufficient',['motion-coverage'],speed);
  const count=m.candidates;
  if(!Number.isInteger(count)||count<0||count>m.samples)return result('insufficient',['motion-invalid'],speed);
  const rate=count*60/seconds;
  const length=count>0?s.targetM/count:null;
  const reasons:string[]=[];
  // Use generous, provisional bounds. Low speed can simply be walking.
  if(speed>12)reasons.push('speed-outside-range');
  if(speed<3)return result('insufficient',['not-sprint-speed',...reasons],speed,rate,length);
  if(count===0)reasons.push('movement-without-peaks');
  else if(count>=6){
    if(length!==null&&(length<0.3||length>3))reasons.push('distance-per-candidate');
    if(rate>320||rate<100)reasons.push('candidate-rate');
  }
  if(reasons.length)return result('discrepancy',reasons,speed,rate,length);
  if(count<6||m.state==='insufficient'||m.state==='irregular')
    return result('insufficient',['rhythm-uncertain'],speed,rate,length);
  if(m.state!=='sprint-like'||m.cadenceSpm===null||!Number.isFinite(m.cadenceSpm)||
    m.cadenceSpm<140||m.cadenceSpm>300)
    return result('discrepancy',['rhythm-outside-sprint-window'],speed,rate,length);
  // Candidate count includes the whole sprint; cadence is a recent median.
  // Large differences are only a diagnostic warning, never proof of manipulation.
  if(Math.abs(rate-m.cadenceSpm)/m.cadenceSpm>0.4)
    return result('discrepancy',['cadence-count-difference'],speed,rate,length);
  return result('compatible',[],speed,rate,length);
}

export const nativeConsistencyReason:Readonly<Record<string,string>>={
 'no-completed-sprint':'Kein vollständig ausgewerteter GPS-Sprint.',
 'motion-coverage':'Bewegungsdaten fehlen oder enthalten größere Aussetzer.',
 'motion-invalid':'Ungültige Bewegungskennzahlen.',
 'speed-outside-range':'GPS-Durchschnittstempo oberhalb des experimentellen Bereichs.',
 'not-sprint-speed':'Durchschnittstempo unterhalb des experimentellen Sprintbereichs.',
 'movement-without-peaks':'GPS-Bewegung ohne erkannte Beschleunigungsspitzen.',
 'distance-per-candidate':'Distanz pro Schrittkandidat außerhalb des großzügigen Testbereichs.',
 'candidate-rate':'Kandidatenzahl und Zeit ergeben eine auffällige Frequenz.',
 'rhythm-uncertain':'Zu wenige oder unregelmäßige Bewegungsspitzen.',
 'rhythm-outside-sprint-window':'Rhythmus außerhalb des experimentellen Sprintfensters.',
 'cadence-count-difference':'Gesamte Kandidatenfrequenz weicht stark von der jüngsten Kadenz ab.'
};
