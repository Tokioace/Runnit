import { useState, type FormEvent } from 'react';
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import type { UseSupabaseUserReturn } from '../../hooks/useSupabaseUser';
import { getAccountDisplayNameError } from '../../lib/accountProfile';

type Props = Pick<UseSupabaseUserReturn, 'signIn' | 'signUp'> & { initialMode?: Mode };
type Mode = 'signin' | 'signup';

function publicAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message.toLowerCase() : '';
  if (raw.includes('invalid login') || raw.includes('invalid credentials')) {
    return 'E-Mail oder Passwort ist nicht korrekt.';
  }
  if (raw.includes('email not confirmed')) {
    return 'Bitte bestätige zuerst die E-Mail-Adresse aus deiner Bestätigungsmail.';
  }
  if (raw.includes('rate limit') || raw.includes('too many')) {
    return 'Zu viele Versuche. Bitte probiere es später erneut.';
  }
  if (raw.includes('password')) {
    return 'Das Passwort erfüllt die Anforderungen noch nicht.';
  }
  if (raw.includes('network') || raw.includes('fetch')) {
    return 'Die Verbindung ist nicht verfügbar. Bitte probiere es erneut.';
  }
  return 'Die Anmeldung konnte nicht abgeschlossen werden. Bitte prüfe die Angaben und versuche es erneut.';
}

export default function AccountAuthPanel({ signIn, signUp, initialMode = 'signin' }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    if (pending) return;
    setMode(next);
    setPassword('');
    setError(null);
    setInfo(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setInfo(null);
    if (mode === 'signup') {
      const errorText = getAccountDisplayNameError(displayName);
      if (errorText) {
        setError(errorText);
        return;
      }
    }
    setPending(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        // Auth state change switches to the authenticated profile view.
      } else {
        await signUp(email, password, displayName);
        setPassword('');
        setMode('signin');
        setInfo('Falls die Registrierung möglich ist, erhältst du eine E-Mail zur Bestätigung. Prüfe auch den Spamordner und melde dich danach an.');
      }
    } catch (e) {
      setError(publicAuthError(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-label="Runnit Benutzerkonto" className="overflow-hidden rounded-[28px] border border-violet-300/20 bg-gradient-to-br from-violet-500/15 via-[#151726] to-[#0c1621] p-5 shadow-[0_20px_60px_rgba(0,0,0,.2)]">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-300/10">
          {mode === 'signup' ? <UserPlus className="h-6 w-6 text-violet-200" aria-hidden="true" /> : <LockKeyhole className="h-6 w-6 text-violet-200" aria-hidden="true" />}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">RUNNIT ACCOUNT</p>
          <h2 className="mt-1 text-lg font-extrabold">{mode === 'signin' ? 'Willkommen zurück.' : 'Dein Konto erstellen.'}</h2>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-1.5" role="group" aria-label="Kontomodus">
        {([{ key: 'signin', label: 'Anmelden' }, { key: 'signup', label: 'Registrieren' }] as const).map(({ key, label }) => (
          <button key={key} type="button" aria-pressed={mode === key} disabled={pending}
            onClick={() => switchMode(key)}
            className={`min-h-11 rounded-xl text-sm font-bold transition-colors ${mode === key ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white' : 'text-white/60 hover:bg-white/10'}`}>
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={(event) => { void submit(event); }} className="mt-6 space-y-4">
        {mode === 'signup' && (
          <div>
            <label htmlFor="account-nickname" className="mb-2 block text-xs font-semibold text-white/75">Anzeigename</label>
            <input id="account-nickname" name="nickname" required type="text" autoComplete="nickname"
              minLength={3} maxLength={24} value={displayName} disabled={pending}
              onChange={event => setDisplayName(event.target.value)} placeholder="z. B. SprintRunner"
              className="min-h-12 w-full rounded-xl border border-white/15 bg-[#101322] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-violet-300/50 focus:ring-2 focus:ring-violet-400/30" />
            <p className="mt-1.5 text-[11px] text-white/45">3–24 Zeichen; später im Profil änderbar. Kein Identitätsnachweis.</p>
          </div>
        )}
        <div>
          <label htmlFor="account-email" className="mb-2 block text-xs font-semibold text-white/75">E-Mail-Adresse</label>
          <input id="account-email" name="email" required type="email" autoComplete="email"
            value={email} disabled={pending} onChange={event => setEmail(event.target.value)}
            placeholder="name@beispiel.de" className="min-h-12 w-full rounded-xl border border-white/15 bg-[#101322] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-violet-300/50 focus:ring-2 focus:ring-violet-400/30" />
        </div>
        <div>
          <label htmlFor="account-password" className="mb-2 block text-xs font-semibold text-white/75">Passwort</label>
          <input id="account-password" name="password" required type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={mode === 'signup' ? 8 : undefined}
            value={password} disabled={pending} onChange={event => setPassword(event.target.value)}
            placeholder={mode === 'signup' ? 'Mindestens 8 Zeichen' : 'Dein Passwort'}
            className="min-h-12 w-full rounded-xl border border-white/15 bg-[#101322] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-violet-300/50 focus:ring-2 focus:ring-violet-400/30" />
        </div>
        {error && <p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-400/10 p-3 text-xs leading-6 text-rose-100">{error}</p>}
        {info && <p role="status" className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-xs leading-6 text-emerald-100">{info}</p>}
        <button type="submit" disabled={pending} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-4 text-sm font-extrabold text-white shadow-[0_15px_35px_rgba(99,102,241,.22)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
          {pending ? 'Bitte warten …' : mode === 'signin' ? 'Anmelden' : 'Konto erstellen'}
          {!pending && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
        </button>
      </form>
      <p className="mt-5 flex items-start gap-2 text-xs leading-6 text-white/50">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
        E-Mail und Passwort werden für die Anmeldung an Supabase Auth gesendet, nicht in der App-Ansicht angezeigt.
      </p>
    </section>
  );
}
