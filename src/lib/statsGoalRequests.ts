/** UI request sequencing only; this does not replace database authorization. */
export function createStatsGoalRequests() {
  let generation=0;
  let phase:'closed'|'idle'|'reading'|'saving'='closed';
  return {
    open(){generation++;phase='idle';},
    close(){generation++;phase='closed';},
    canRefresh:()=>phase==='idle'||phase==='reading',
    beginRead(){
      if(phase==='closed'||phase==='saving')return null;
      const token=++generation;phase='reading';
      const current=()=>generation===token&&phase==='reading';
      return {current,finish(){if(current())phase='idle';}};
    },
    beginSave(){
      if(phase!=='idle')return null;
      const token=++generation;phase='saving';
      const current=()=>generation===token&&phase==='saving';
      return {current,finish(){if(current())phase='idle';}};
    },
  };
}
