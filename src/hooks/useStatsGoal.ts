import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { createStatsGoalRequests } from '../lib/statsGoalRequests';

const DEFAULT_GOAL_M = 1000;
const ALLOWED_GOALS_M = [1000,3000,5000,10000] as const;

export function useStatsGoal(userId:string|null|undefined) {
  const [goalM,setGoalM] = useState<number>(DEFAULT_GOAL_M);
  const [loading,setLoading] = useState(Boolean(userId));
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [revision,setRevision] = useState(0);
  const requests=useRef(createStatsGoalRequests());
  useLayoutEffect(()=>{
    const gate=requests.current;
    gate.open();
    setGoalM(DEFAULT_GOAL_M);setLoading(Boolean(userId));setSaving(false);setError(null);
    return()=>gate.close();
  },[userId]);
  const refresh=useCallback(()=>{
    if(requests.current.canRefresh())setRevision(n=>n+1);
  },[]);
  useEffect(()=>{
    if(!userId)return;
    const read=requests.current.beginRead();
    if(!read)return;
    let active=true;
    const current=()=>active&&read.current();
    setLoading(true);
    setError(null);
    (async()=>{
      const response=await supabase.from('runner_stats_preferences')
        .select('weekly_distance_goal_m')
        .eq('user_id',userId).maybeSingle();
      if(!current())return;
      if(response.error){
        setError('Das Wochenziel konnte nicht aus Supabase geladen werden.');
      }else {
        const saved=response.data?.weekly_distance_goal_m;
        setGoalM(typeof saved==='number' && ALLOWED_GOALS_M.includes(saved as typeof ALLOWED_GOALS_M[number])?saved:DEFAULT_GOAL_M);
      }
    })().catch(()=>{
      if(current())setError('Das Wochenziel konnte nicht geladen werden.');
    }).finally(()=>{
      if(current()){read.finish();setLoading(false);}
    });
    return()=>{active=false;read.finish();};
  },[userId,revision]);
  const save=useCallback(async(next:number):Promise<boolean>=>{
    if(!userId || !ALLOWED_GOALS_M.includes(next as typeof ALLOWED_GOALS_M[number]))return false;
    const write=requests.current.beginSave();
    if(!write)return false;
    setSaving(true);setError(null);
    try {
      const result=await supabase.from('runner_stats_preferences')
        .upsert({user_id:userId,weekly_distance_goal_m:next},{onConflict:'user_id'})
        .select('weekly_distance_goal_m').single();
      if(!write.current())return false;
      if(result.error || result.data?.weekly_distance_goal_m!==next)throw result.error||new Error('Unexpected saved goal');
      setGoalM(next);
      return true;
    } catch {
      if(write.current())setError('Wochenziel konnte nicht gespeichert werden. Bitte erneut versuchen.');
      return false;
    } finally {
      if(write.current()){write.finish();setSaving(false);}
    }
  },[userId]);
  return {goalM,loading,saving,error,refresh,save};
}
