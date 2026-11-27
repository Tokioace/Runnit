import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNativeAuthStorage,purgeLegacyNativeAuth} from '../src/lib/nativeAuthStorage.ts';
const key='sb-project-auth-token';
test('native storage uses vault for write, read and removal without browser fallback',async()=>{
 const store=new Map(), calls=[];
 const bridge={async nativePromise(plugin,method,options){
  assert.equal(plugin,'RunnitSessionVault');calls.push(method);
  if(method==='readSession')return {value:store.get(options.key)??null};
  if(method==='writeSession')store.set(options.key,options.value);
  if(method==='removeSession')store.delete(options.key);
 }};
 const adapter=createNativeAuthStorage(bridge);
 assert.equal(await adapter.getItem(key),null);
 await adapter.setItem(key,'synthetic-session');
 assert.equal(await createNativeAuthStorage(bridge).getItem(key),'synthetic-session');
 await adapter.removeItem(key);assert.equal(await adapter.getItem(key),null);
 assert.deepEqual(calls,['readSession','writeSession','readSession','removeSession','readSession']);
});
test('no native bridge means memory only; errors from a real bridge are not hidden',async()=>{
 const volatile=createNativeAuthStorage();
 await volatile.setItem(key,'test');
 assert.equal(await volatile.getItem(key),'test');
 assert.equal(await createNativeAuthStorage().getItem(key),null);
 const bad=createNativeAuthStorage({nativePromise:async()=>{throw new Error('secret-details');}});
 await assert.rejects(bad.getItem(key),/Native session storage unavailable/);
 await assert.rejects(bad.setItem(key,'x'),/Native session storage unavailable/);
 await assert.rejects(bad.removeItem(key),/Native session storage unavailable/);
 await assert.rejects(volatile.setItem('unrelated-key','x'),/Unsupported/);
});
test('native legacy cleanup touches only SDK auth keys and never imports them',()=>{
 const keys=['theme','sb-project-auth-token','runnit:guest-mode','sb-project-auth-token-code-verifier','other'];
 const storage={get length(){return keys.length},key:i=>keys[i],removeItem:k=>keys.splice(keys.indexOf(k),1)};
 purgeLegacyNativeAuth(storage);
 assert.deepEqual(keys,['theme','runnit:guest-mode','other']);
});
test('native vault has non-sync device-only protection and preview wiring',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const swift=read('native/ios-preview/RunnitSessionVault.swift');
 assert.match(swift,/kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);
 assert.match(swift,/kSecAttrSynchronizable as String: false/);
 assert.match(swift,/isExcludedFromBackup = true/);
 assert.match(swift,/SecItemDelete/);
 assert.match(read('src/lib/supabaseClient.ts'),/isNativeAuthRuntime\(\) \? \{ storage: nativeAuthStorageForWindow\(\) \}/);
 assert.equal(JSON.parse(read('native/ios-preview/capacitor.config.json')).loggingBehavior,'none');
 assert.match(read('scripts/build-ios-preview.sh'),/python3 install-ios-vault.py/);
});

test('native storage rejects malformed bridge payloads rather than coercing them',async()=>{
 for(const response of [null,undefined,{}, {value:undefined},{value:0},{value:false},{value:['token']},{value:{token:'x'}}]) {
  const adapter=createNativeAuthStorage({nativePromise:async()=>response});
  await assert.rejects(adapter.getItem(key),/Invalid native session response/);
 }
});


test('vault byte limits agree for ASCII and multibyte UTF-8 including memory-only fallback',async()=>{
 const max='é'.repeat(131072),tooLarge=max+'é';
 let writes=0;
 const native=createNativeAuthStorage({nativePromise:async(plugin,method)=>{
  if(method==='writeSession')writes++;
  if(method==='readSession')return {value:tooLarge};
 }});
 await native.setItem(key,max);
 await assert.rejects(native.setItem(key,tooLarge),/Invalid native session value/);
 assert.equal(writes,1);
 await assert.rejects(native.getItem(key),/Invalid native session response/);
 const memory=createNativeAuthStorage();
 await memory.setItem(key,max);
 await assert.rejects(memory.setItem(key,tooLarge),/Invalid native session value/);
 assert.equal(await memory.getItem(key),max);
});
