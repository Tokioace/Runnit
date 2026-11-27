// Native session storage for the bundled iOS WebView only. No dependency in the
// browser bundle on a secure-storage plugin's insecure web fallback.
type Bridge = { nativePromise(plugin:string, method:string, options:Record<string,string>): Promise<unknown> };
type StorageLike = Pick<Storage,'length'|'key'|'removeItem'>;
const keyPattern = /^sb-[a-zA-Z0-9-]{1,100}-auth-token(?:-code-verifier|-user)?$/;
function checkKey(key:string) {
  if (!keyPattern.test(key)) throw new Error('Unsupported native auth storage key');
}
export function purgeLegacyNativeAuth(storage:StorageLike):void {
  for(let i=storage.length-1;i>=0;i--){
    const key=storage.key(i);
    if(key && keyPattern.test(key)) storage.removeItem(key);
  }
}
export function createNativeAuthStorage(bridge?:Bridge) {
  // When no native bridge exists (e.g. a mock preview), use only volatile RAM.
  // Once a bridge is selected, do not silently fall back after any Keychain error.
  const volatile = new Map<string,string>();
  const invoke = async (method:string, options:Record<string,string>) => {
    try { return await bridge!.nativePromise('RunnitSessionVault',method,options); }
    catch { throw new Error('Native session storage unavailable'); }
  };
  return {
    async getItem(key:string):Promise<string|null>{
      checkKey(key);
      if(!bridge)return volatile.get(key)??null;
      const result=await invoke('readSession',{key});
      if(!result||typeof result!=='object'||!('value' in result))throw new Error('Invalid native session response');
      const value=result.value;
      if(value===null)return null;
      if(typeof value==='string'&&new TextEncoder().encode(value).byteLength<=262144)return value;
      throw new Error('Invalid native session response');
    },
    async setItem(key:string,value:string):Promise<void>{
      checkKey(key);
      if(typeof value!=='string'||new TextEncoder().encode(value).byteLength>262144)throw new Error('Invalid native session value');
      if(!bridge){volatile.set(key,value);return;}
      await invoke('writeSession',{key,value});
    },
    async removeItem(key:string):Promise<void>{
      checkKey(key);
      if(!bridge){volatile.delete(key);return;}
      await invoke('removeSession',{key});
    },
  };
}
export function nativeAuthStorageForWindow(){
  const nativeWindow=window as Window & {Capacitor?:Partial<Bridge>};
  try{purgeLegacyNativeAuth(nativeWindow.localStorage);}catch{/* Storage can be unavailable; never read legacy tokens. */}
  const cap=nativeWindow.Capacitor;
  const bridge=typeof cap?.nativePromise==='function'?cap as Bridge:undefined;
  return createNativeAuthStorage(bridge);
}
