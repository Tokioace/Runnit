import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isBundledIosLocation,emailLoginOptions,authCallbackUrl} from '../src/lib/authRedirect.ts';
test('only the bundled Capacitor origin opts into native email auth',()=>{
 assert.equal(isBundledIosLocation('capacitor://localhost/login'),true);
 for(const url of ['https://localhost/login','http://localhost','capacitor://localhost.evil.test','capacitor://localhost:1234','capacitor://a@localhost','file:///tmp/index.html','bad']){
   assert.equal(isBundledIosLocation(url),false);
 }
});
test('native OTP uses existing accounts and never requests a custom-scheme callback',()=>{
 assert.deepEqual(emailLoginOptions('capacitor://localhost/login','null'),{shouldCreateUser:false});
 assert.throws(()=>authCallbackUrl('capacitor://localhost'));
});
test('web passwordless callback and registration behavior stay unchanged',()=>{
 assert.deepEqual(emailLoginOptions('https://runnit.test/login','https://runnit.test'),{emailRedirectTo:'https://runnit.test/auth/callback',shouldCreateUser:true});
 assert.equal(emailLoginOptions('http://localhost:5173/login','http://localhost:5173').emailRedirectTo,'http://localhost:5173/auth/callback');
 assert.throws(()=>emailLoginOptions('http://evil.test/login','http://evil.test'));
});
test('native UI and SDK both gate unfinished callback paths',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 assert.match(read('src/hooks/useSupabaseUser.ts'),/if \(isNativeAuthRuntime\(\)\) throw new Error/);
 assert.match(read('src/lib/supabaseClient.ts'),/detectSessionInUrl: !isNativeAuthRuntime\(\)/);
 assert.match(read('src/components/auth/WelcomeAuthScreen.tsx'),/\{!nativeAuth && <button/);
});
