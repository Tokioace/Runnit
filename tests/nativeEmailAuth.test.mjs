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

test('native forgotten-password guidance uses existing account OTP and guarded profile password change',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const welcome=read('src/components/auth/WelcomeAuthScreen.tsx');
 assert.match(welcome,/nativeAuth \? 'Passwort vergessen\? E-Mail-Code verwenden' : 'Lieber ohne Passwort\? Anmeldelink oder Code verwenden'/);
 assert.match(welcome,/Profil → Konto → Passwort ändern/);
 assert.match(welcome,/Ohne Code oder gültiges Passwort kannst du dich in dieser iOS-Vorschau noch nicht anmelden/);
 assert.match(welcome,/await verifyEmailOtp\(verificationEmail, otpCode\)/);
 assert.match(read('src/lib/authRedirect.ts'),/if \(isBundledIosLocation\(href\)\) return \{ shouldCreateUser: false \}/);
 const profile=read('src/screens/ProfileScreen.tsx');
 assert.match(profile,/open\('account'\)/);
 assert.match(profile,/changePassword=\{changePassword\}/);
 const details=read('src/components/profile/AccountDetailsPanel.tsx');
 assert.match(details,/Passwort ändern/);
 assert.match(details,/await changePassword\(newPassword\)/);
 const hook=read('src/hooks/useSupabaseUser.ts');
 const change=hook.slice(hook.indexOf('const changePassword ='),hook.indexOf('const updateDisplayName ='));
 assert.ok(change.indexOf('await confirmMutationIdentity')>=0);
 assert.ok(change.indexOf('await confirmMutationIdentity')<change.indexOf('supabase.auth.updateUser({ password })'));
 assert.match(change,/data.user\?\.id !== user\?\.id/);
});
