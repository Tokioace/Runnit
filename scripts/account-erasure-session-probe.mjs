// Disposable test project only. No credentials or returned rows are logged.
import {validateTestTarget} from './account-erasure-core.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createErasureSessionProbe(admin,{url,ref,userId,controlDuelId,publishableKey,accessToken},fetcher=fetch,now=Date.now){
  validateTestTarget(url,ref,userId);
  if (!UUID.test(controlDuelId || '') || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey || '') ||
      typeof accessToken!=='string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(accessToken))
    throw new Error('Separate synthetic control duel, publishable key and user token required');
  let claims;
  try { claims=JSON.parse(Buffer.from(accessToken.split('.')[1],'base64url').toString('utf8')); }
  catch { throw new Error('Invalid test token claims'); }
  if (!claims || claims.sub!==userId || claims.role!=='authenticated' || !UUID.test(claims.session_id || '') || !Number.isSafeInteger(claims.exp))
    throw new Error('Expected authenticated synthetic session');
  const fresh=()=>{if(claims.exp*1000-now()<30000) throw new Error('Test token expires too soon; session denial not verified');};
  const request=async path=>{
    try { return await fetcher(url+path,{headers:{apikey:publishableKey,Authorization:'Bearer '+accessToken},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)}); }
    catch {throw new Error('Test session request failed');}
  };
  const json=async response=>{try{return await response.json();}catch{throw new Error('Invalid test session response');}};
  const control=async()=>{
    const result=await admin.from('duels').select('id,host_user_id,challenger_user_id,status').eq('id',controlDuelId).maybeSingle();
    const row=result?.data;
    if(result?.error || !row || row.id!==controlDuelId || !UUID.test(row.host_user_id || '') || row.host_user_id===userId || row.challenger_user_id!==null || row.status!=='open')
      throw new Error('Independent open synthetic control duel unavailable');
    return row.host_user_id;
  };
  const path='/rest/v1/duels?select=id&id=eq.'+controlDuelId;
  let host=null;
  return {
    async before(){
      // Never retain a previous successful baseline across a failed preflight.
      host=null;
      fresh();
      const identity=await request('/auth/v1/user');
      if(identity.status!==200 || (await json(identity))?.id!==userId) throw new Error('Test token identity not verified');
      const candidateHost=await control();
      const response=await request(path);
      const rows=response.status===200?await json(response):null;
      if(!Array.isArray(rows) || rows.length!==1 || rows[0]?.id!==controlDuelId) throw new Error('Control duel must be visible before erasure');
      fresh();
      host=candidateHost;
    },
    async after(){
      if(!host) throw new Error('Session probe requires successful preflight');
      const expectedHost=host;
      // Consume the baseline once, including when a post-deletion check fails.
      host=null;
      fresh();
      const response=await request(path);
      if(response.status===200){
        const rows=await json(response);
        if(!Array.isArray(rows) || rows.length!==0) throw new Error('Revoked session can still read control duel');
      }else if(response.status!==401 && response.status!==403) throw new Error('Revoked session denial not verified');
      if(await control()!==expectedHost) throw new Error('Control duel changed; session denial not verified');
      fresh();
    }
  };
}
