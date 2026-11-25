import {createNativeAuthStorage} from './nativeAuthStorage.ts';
import {isBundledIosLocation} from './authRedirect.ts';

type Bridge = Parameters<typeof createNativeAuthStorage>[0];
const key='sb-runnit-preview-smoke-auth-token';
const payload='synthetic-simulator-smoke-v1';

/** Runs only in a prepared simulator preview after the welcome screen commits.
 * No real session, account, location or motion permission is used. */
export async function runPreviewSmoke(bridge:NonNullable<Bridge>):Promise<void>{
 const ping=await bridge.nativePromise('RunnitSensorProbe','previewPing',{});
 if(!ping||typeof ping!=='object'||!('ready' in ping)||ping.ready!==true)
   throw new Error('Preview sensor bridge not ready');
 const storage=createNativeAuthStorage(bridge);
 try{
   await storage.setItem(key,payload);
   if(await storage.getItem(key)!==payload)throw new Error('Preview vault read mismatch');
 }finally{
   await storage.removeItem(key);
 }
 if(await storage.getItem(key)!==null)throw new Error('Preview vault removal mismatch');
 await bridge.nativePromise('RunnitSessionVault','previewSmokeComplete',{});
}
export function shouldRunPreviewSmoke(enabled:unknown,href:string):boolean{
 return enabled==='true'&&isBundledIosLocation(href);
}
let attempted=false;
export function maybeRunPreviewSmoke(enabled:unknown):void{
 if(attempted||typeof window==='undefined'||!shouldRunPreviewSmoke(enabled,window.location.href))return;
 const bridge=(window as Window & {Capacitor?:Bridge}).Capacitor;
 if(!bridge||typeof bridge.nativePromise!=='function')return;
 attempted=true;
 // Deliberately do not log tokens, errors or private data. Missing marker fails CI.
 void runPreviewSmoke(bridge).catch(()=>{});
}
