/** One active recovery request plus one coalesced follow-up. No stale
 * response may update the UI after a newer confirmed race transition. */
export function createDuelRecoveryQueue(task:()=>Promise<void>){
 let closed=false, running=false, pending=false;
 async function drain(){
  if(closed||running)return;
  running=true;
  try{
   do{
    pending=false;
    try{await task();}catch{ /* A transport failure is not a race outcome. */ }
   }while(!closed&&pending);
  }finally{running=false;}
 }
 return {
  // Explicit focus/reconnect signals deserve one follow-up. Routine polls
  // can wait for the next interval instead of keeping a slow connection busy.
  request:()=>{if(closed)return;pending=true;void drain();},
  poll:()=>{if(closed||running)return;pending=true;void drain();},
  close:()=>{closed=true;pending=false;},
 };
}
export function isCurrentRecovery(
 active:boolean, account:string|null, expectedAccount:string,
 revision:number, expectedRevision:number
):boolean{
 return active&&account===expectedAccount&&revision===expectedRevision;
}
