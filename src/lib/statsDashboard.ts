import { isRecordedBy, type RaceHistoryItem, type StoredGhostSession } from './runnerHistory.ts';

export type StatsDay = { key: string; label: string; sessions: number; measuredDistanceM: number };
export type StatsOverview = {
  days: StatsDay[];
  completedDuels: number; wins: number; losses: number; ties: number;
  ghostTrainings: number; soloTrainings: number;
  totalRecordedDistanceM: number | null;
  weeklyMeasuredDistanceM: number | null;
  activeDaysThisWeek: number;
  currentStreak: number;
  bestTimes: Record<50 | 75 | 100, number | null>;
};

const finiteNonnegative = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;

const dateKey = (stamp: string): string | null => {
  const date = new Date(stamp);
  if (!Number.isFinite(date.getTime())) return null;
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
};
const localKey = (date: Date): string => [
  date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')
].join('-');

/**
 * Aggregates only authenticated Supabase history. No fake demo values:
 * - an unpaired duel is not a completed race;
 * - a stopped ghost training is not an activity;
 * - a configured target distance is never substituted for missing GPS.
 * Ghost sessions are counted as solo trainings (not twice).
 */
export function calculateStatsOverview(
  races: readonly RaceHistoryItem[],
  ghostSessions: readonly StoredGhostSession[],
  now: Date = new Date()
): StatsOverview {
  const asOfMs = now.getTime();
  const completed = races.filter(r=>r.completed && r.timeMs>0 && Number.isFinite(r.timeMs) &&
    isRecordedBy(r.occurredAt, asOfMs));
  const finishedGhosts = ghostSessions.filter(g=>g.run_state==='finished' &&
    typeof g.elapsed_ms==='number' && Number.isFinite(g.elapsed_ms) && g.elapsed_ms>0 &&
    isRecordedBy(g.created_at, asOfMs));

  const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const monday = new Date(today);
  monday.setDate(today.getDate()-((today.getDay()+6)%7));
  const labels = ['MO','DI','MI','DO','FR','SA','SO'];
  const days: StatsDay[] = labels.map((label,i)=>{
    const day = new Date(monday);
    day.setDate(monday.getDate()+i);
    return {key:localKey(day),label,sessions:0,measuredDistanceM:0};
  });
  const byKey = new Map(days.map(day=>[day.key,day]));
  const activeDates = new Set<string>();
  let totalDistance = 0, totalMeasurements = 0;
  let weekDistance = 0, weekMeasurements = 0;
  const add = (stamp:string, distance:number|null|undefined) => {
    const key=dateKey(stamp);
    if (!key) return;
    activeDates.add(key);
    const day=byKey.get(key);
    if(day)day.sessions++;
    if(finiteNonnegative(distance)){
      totalDistance+=distance;
      totalMeasurements++;
      if(day){day.measuredDistanceM+=distance;weekDistance+=distance;weekMeasurements++;}
    }
  };
  completed.forEach(r=>add(r.occurredAt,r.measuredDistanceM));
  finishedGhosts.forEach(g=>add(g.created_at,g.observed_distance_m));

  // An active streak includes today, or ends yesterday when no run yet today.
  const cursor = new Date(today);
  if(!activeDates.has(localKey(cursor)))cursor.setDate(cursor.getDate()-1);
  let streak=0;
  while(streak<366 && activeDates.has(localKey(cursor))){
    streak++;
    cursor.setDate(cursor.getDate()-1);
  }
  const best = (distance:50|75|100) => {
    const times=completed.filter(r=>r.distanceM===distance).map(r=>r.timeMs);
    return times.length?Math.min(...times):null;
  };
  return {
    days,
    completedDuels:completed.length,
    wins:completed.filter(r=>r.outcome==='won').length,
    losses:completed.filter(r=>r.outcome==='lost').length,
    ties:completed.filter(r=>r.outcome==='tie').length,
    ghostTrainings:finishedGhosts.length,
    soloTrainings:finishedGhosts.length,
    totalRecordedDistanceM:totalMeasurements?totalDistance:null,
    weeklyMeasuredDistanceM:weekMeasurements?weekDistance:null,
    activeDaysThisWeek:days.filter(d=>d.sessions>0).length,
    currentStreak:streak,
    bestTimes:{50:best(50),75:best(75),100:best(100)},
  };
}

export function formatStatsDistance(distanceM: number|null|undefined): string {
  return finiteNonnegative(distanceM) ? (distanceM/1000).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' km' : '—';
}
export function formatStatsTime(timeMs: number|null|undefined): string {
  if (!finiteNonnegative(timeMs) || timeMs===0) return '—';
  const cs=Math.round(timeMs/10);
  const min=Math.floor(cs/6000);
  const sec=Math.floor(cs/100)%60;
  return String(min).padStart(2,'0')+':'+String(sec).padStart(2,'0')+','+String(cs%100).padStart(2,'0');
}
export function clampProgress(progress:number):number {
  return Number.isFinite(progress)?Math.min(1,Math.max(0,progress)):0;
}
