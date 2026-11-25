// Postgres Changes is a notification stream, not an authorization boundary.
// Delete events may contain only a primary key even with RLS enabled.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuses = new Set(['open','matched','completed','cancelled','expired','abandoned']);
type Row = Record<string, unknown> & {id:string};
function object(value:unknown):Record<string,unknown>|null {
 return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
}
export function duelRealtimeRow(payload:unknown):Row|null {
 const event=object(payload);
 if(!event||event.schema!=='public'||event.table!=='duels')return null;
 const kind=event.eventType;
 if(kind!=='INSERT'&&kind!=='UPDATE'&&kind!=='DELETE')return null;
 const row=object(kind==='DELETE'?event.old:event.new);
 if(!row||typeof row.id!=='string'||!UUID.test(row.id))return null;
 if(kind==='DELETE')return {id:row.id};
 if(typeof row.status!=='string'||!statuses.has(row.status))return null;
 if(typeof row.host_user_id!=='string'||!UUID.test(row.host_user_id))return null;
 if((row.status==='matched'||row.status==='completed')&&
   (typeof row.challenger_user_id!=='string'||!UUID.test(row.challenger_user_id)||row.challenger_user_id===row.host_user_id))return null;
 return {...row,id:row.id};
}
// Close synchronously, before asynchronous channel removal. A queued callback
// from a retired subscription must not alter the current account's state.
export function createDuelRealtimeLifetime(){
 let active=true;
 return {
  isActive:()=>active,
  close:()=>{active=false;},
 };
}
