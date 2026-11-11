import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight, CheckCircle2, ChevronLeft, Footprints,
  LockKeyhole, Mail, ShieldCheck,
} from 'lucide-react';
import type { UseSupabaseUserReturn } from '../../hooks/useSupabaseUser';
import type { SocialProvider } from '../../lib/authRedirect';
import AccountAuthPanel from '../profile/AccountAuthPanel';
import { Link } from 'react-router-dom';

type Props = Pick<UseSupabaseUserReturn,
  'signInWithProvider' | 'sendMagicLink' | 'verifyEmailOtp' | 'signIn' | 'signUp' | 'loadError'
> & { onContinueAsGuest: () => void; initialMode?: 'signin' | 'signup' };

type EmailMode = 'hidden' | 'magic-link' | 'password';

const providers: { id: SocialProvider; title: string; marker: string; style: string }[] = [
  { id: 'apple', title: 'Mit Apple fortfahren', marker: '', style: 'border-white/15 bg-white text-slate-950 hover:bg-white/90' },
  { id: 'google', title: 'Mit Google fortfahren', marker: 'G', style: 'border-white/15 bg-[#182033] text-white hover:bg-[#222e49]' },
  { id: 'facebook', title: 'Mit Facebook fortfahren', marker: 'f', style: 'border-blue-500/25 bg-[#15254b] text-white hover:bg-[#20376c]' },
];

function authErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message.toLowerCase() : '';
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code).toLowerCase() : '';
  if (code === 'email_address_not_authorized' || detail.includes('email address not authorized')) {
    return 'Supabase darf an diese E-Mail-Adresse noch nicht senden. Für normale Runnit-Konten muss ein eigener SMTP-Mailserver eingerichtet werden.';
  }
  if (code === 'over_email_send_rate_limit' || detail.includes('email rate limit') || detail.includes('for security purposes, you can only request this after')) {
    return 'Supabase blockiert derzeit weitere E-Mails wegen eines Versandlimits oder einer kurzen Wartefrist. Bitte fordere nicht wiederholt einen Code an und versuche es später erneut.';
  }
  if (detail.includes('provider') || detail.includes('unsupported') || detail.includes('disabled')) {
    return 'Dieser Anmeldeanbieter ist im Runnit-Backend noch nicht aktiviert.';
  }
  if (detail.includes('expired') || detail.includes('invalid token') || detail.includes('otp')) {
    return 'Dieser Code ist ungültig oder abgelaufen. Bitte fordere einen neuen Code an.';
  }
  if (detail.includes('over_email_send_rate_limit') || (detail.includes('email') && detail.includes('rate limit'))) {
    return 'Der E-Mail-Versand ist vorübergehend begrenzt. Warte mit einem neuen Link; du kannst Runnit solange als Gast erkunden.';
  }
  if (detail.includes('rate limit') || detail.includes('too many')) {
    return 'Zu viele Anmeldeversuche. Bitte warte etwas und versuche es dann erneut.';
  }
  if (detail.includes('network') || detail.includes('fetch')) {
    return 'Keine Verbindung zum Anmeldedienst. Prüfe bitte dein Internet.';
  }
  if (detail.includes('redirect') || detail.includes('url not allowed')) {
    return 'Die Rückkehradresse ist noch nicht für die Anmeldung freigegeben.';
  }
  return 'Anmeldung konnte nicht gestartet werden. Bitte versuche es erneut oder nutze E-Mail.';
}

export default function WelcomeAuthScreen({ signInWithProvider, sendMagicLink, verifyEmailOtp, signIn, signUp, loadError, onContinueAsGuest, initialMode = 'signin' }: Props) {
  const [emailMode, setEmailMode] = useState<EmailMode>('password');
  const [email, setEmail] = useState('');
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailResendCooldown, setEmailResendCooldown] = useState(0);

  useEffect(() => {
    if (emailResendCooldown <= 0) return;
    const interval = window.setInterval(() => {
      setEmailResendCooldown(seconds => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [emailResendCooldown > 0]);

  const startProvider = async (provider: SocialProvider) => {
    if (pending) return;
    setPending(provider);
    setError(null);
    setNotice(null);
    try {
      await signInWithProvider(provider);
      // Supabase will redirect to the provider; a completed session unlocks the app.
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setPending(null);
    }
  };

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || emailResendCooldown > 0) return;
    setPending('email');
    setError(null);
    setNotice(null);
    try {
      await sendMagicLink(email);
      setEmailResendCooldown(60);
      setVerificationEmail(email.trim());
      setOtpCode('');
      setNotice('Falls die E-Mail zugestellt wird, enthält sie deinen Anmeldelink. Wenn zusätzlich ein sechsstelliger Code enthalten ist, kannst du ihn direkt hier eingeben. Prüfe auch den Spamordner.');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setPending(null);
    }
  };

  const submitOtpCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !verificationEmail) return;
    setPending('otp');
    setError(null);
    setNotice(null);
    try {
      await verifyEmailOtp(verificationEmail, otpCode);
      // Supabase emits SIGNED_IN; the global session gate opens the app.
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setPending(null);
    }
  };

  const openEmail = () => {
    setEmailMode('magic-link');
    setError(null);
    setNotice(null);
  };

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#080d21] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-40 -top-48 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/25 blur-[100px]" />
        <div className="absolute -left-36 top-[23rem] h-[24rem] w-[24rem] rounded-full bg-cyan-500/10 blur-[85px]" />
        <div className="absolute inset-x-0 top-0 h-[25rem] opacity-25" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)',
          backgroundSize: '38px 38px',
          maskImage: 'linear-gradient(to bottom,black,transparent)',
        }} />
      </div>

      <div className="relative mx-auto w-full max-w-md">
        <Link to="/" className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white/80 hover:text-white">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Zurück zu RUNNIT
        </Link>

        <header className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 text-lg font-black italic tracking-[0.14em]">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10">
              <Footprints className="h-5 w-5 text-cyan-200" aria-hidden="true" />
            </span>
            RUNNIT<span className="text-cyan-300">.</span>
          </span>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-bold tracking-widest text-white/50">BETA</span>
        </header>

        <section aria-labelledby="account-page-title" className="mt-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-300">
            {initialMode === 'signup' ? 'NEUER RUNNER // JOIN' : 'WELCOME BACK // SIGN IN'}
          </p>
          <h1 id="account-page-title" className="mt-2 text-[clamp(2.2rem,10vw,3.4rem)] font-black italic uppercase leading-none tracking-[-0.04em]">
            {initialMode === 'signup' ? 'REGISTRIEREN.' : 'ANMELDEN.'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/70">
            {initialMode === 'signup'
              ? 'Erstelle dein RUNNIT-Konto, damit du echte Lauf-Duelle starten und annehmen kannst.'
              : 'Du hast schon ein Konto? Melde dich mit deiner E-Mail-Adresse und deinem Passwort an – du brauchst kein neues Konto.'}
          </p>
        </section>

        <section aria-label={initialMode === 'signup' ? 'Konto registrieren' : 'Bei RUNNIT anmelden'} className="mt-5">
          {emailMode === 'password' ? (
            <div className="space-y-3">
              <AccountAuthPanel signIn={signIn} signUp={signUp} initialMode={initialMode} hideModeSwitch />
              {initialMode === 'signin' && (
                <button type="button" onClick={openEmail} className="min-h-11 w-full rounded-xl text-center text-xs font-bold text-cyan-200 hover:text-white">
                  Lieber ohne Passwort? Anmeldelink oder Code verwenden
                </button>
              )}
              <button type="button" onClick={() => { setEmailMode('hidden'); setError(null); setNotice(null); }}
                className="min-h-11 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-center text-xs font-bold text-white/80 hover:bg-white/10">
                Weitere Anmeldearten (Apple, Google, Facebook)
              </button>
            </div>
          ) : emailMode === 'hidden' ? (
            <div className="space-y-3 rounded-[26px] border border-violet-300/20 bg-[#11172b]/95 p-5">
              <h2 className="text-lg font-extrabold">Mit einem Anbieter fortfahren</h2>
              <p className="text-xs leading-5 text-white/60">Die Anbieter müssen im RUNNIT-Backend freigeschaltet sein.</p>
              {providers.map(({ id, title, marker, style }) => (
                <button key={id} type="button" disabled={Boolean(pending)} onClick={() => { void startProvider(id); }}
                  className={\`flex min-h-14 w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-colors disabled:opacity-55 \${style}\`}>
                  <span className={\`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl font-black \${id === 'apple' ? 'text-slate-950' : id === 'facebook' ? 'text-blue-400' : 'text-white'}\`} aria-hidden="true">{marker}</span>
                  <span className="flex-1">{pending === id ? 'Weiterleitung …' : title}</span>
                  <ArrowRight className="h-4 w-4 opacity-55" aria-hidden="true" />
                </button>
              ))}
              <button type="button" onClick={() => { setEmailMode('password'); setError(null); setNotice(null); }}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 text-sm font-bold text-cyan-100">
                <Mail className="h-5 w-5" aria-hidden="true" /> Mit E-Mail fortfahren
              </button>
              {initialMode === 'signin' && (
                <button type="button" onClick={openEmail} className="min-h-11 w-full text-center text-xs font-bold text-cyan-200">
                  Anmeldelink oder E-Mail-Code nutzen
                </button>
              )}
            </div>
          ) : (
            <section aria-label="Anmeldelink und E-Mail-Code" className="space-y-4 rounded-[26px] border border-cyan-300/20 bg-[#11172b]/95 p-5">
              <button type="button" onClick={() => { setEmailMode('password'); setError(null); setNotice(null); }}
                className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-cyan-200 hover:text-white">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Zur Anmeldung mit Passwort
              </button>
              <h2 className="text-lg font-extrabold">Ohne Passwort anmelden</h2>
              <p className="text-xs leading-5 text-white/60">Du erhältst einen Anmeldelink. Alternativ kannst du den sechsstelligen Code eingeben, falls er in der E-Mail steht.</p>
              <form onSubmit={event => { void submitEmail(event); }} className="space-y-3">
                <label htmlFor="welcome-email" className="block text-xs font-bold text-white/75">E-Mail-Adresse</label>
                <input id="welcome-email" type="email" required autoComplete="email" inputMode="email"
                  disabled={Boolean(pending)} value={email} onChange={e => { setEmail(e.target.value); setVerificationEmail(null); setOtpCode(''); setNotice(null); }}
                  placeholder="name@beispiel.de"
                  className="min-h-14 w-full rounded-2xl border border-white/20 bg-[#0d1322] px-4 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-cyan-300/50" />
                <button type="submit" disabled={Boolean(pending) || emailResendCooldown > 0}
                  className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 text-sm font-extrabold text-[#061027] transition hover:brightness-110 disabled:opacity-50">
                  {pending === 'email' ? 'E-Mail wird angefordert …' : emailResendCooldown > 0 ? \`Erneut senden in \${emailResendCooldown} s\` : verificationEmail ? 'Neuen Link oder Code senden' : 'Anmeldelink senden'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
              {verificationEmail && (
                <form onSubmit={event => { void submitOtpCode(event); }} className="space-y-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
                  <p className="flex items-center gap-2 text-xs font-bold text-emerald-200">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> E-Mail angefordert
                  </p>
                  <label htmlFor="welcome-otp" className="block text-xs font-semibold text-white/75">Sechsstelliger E-Mail-Code (falls vorhanden)</label>
                  <input id="welcome-otp" name="one-time-code" type="text" inputMode="numeric"
                    autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
                    value={otpCode} disabled={Boolean(pending)}
                    onChange={event => setOtpCode(event.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    className="min-h-14 w-full rounded-2xl border border-emerald-300/20 bg-[#0d1322] px-4 text-center text-lg font-black tracking-[0.2em] text-white outline-none placeholder:text-white/20 focus:ring-2 focus:ring-emerald-300/50" />
                  <button type="submit" disabled={Boolean(pending) || otpCode.length !== 6}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-extrabold text-slate-950 disabled:opacity-50">
                    {pending === 'otp' ? 'Code wird geprüft …' : 'Mit Code anmelden'}
                  </button>
                  <p className="text-[11px] leading-5 text-white/55">Der Code funktioniert im selben Browser. Falls du nur einen Link erhältst, muss die Supabase-Mailvorlage einen Code enthalten.</p>
                </form>
              )}
            </section>
          )}

          <p className="mt-5 text-center text-sm font-medium text-white/65">
            {initialMode === 'signin' ? 'Noch kein Konto?' : 'Schon registriert?'}
            {' '}
            <Link to={initialMode === 'signin' ? '/register' : '/login'}
              className="inline-flex min-h-11 items-center font-black text-cyan-200 underline decoration-cyan-200/50 underline-offset-4 hover:text-white">
              {initialMode === 'signin' ? 'Jetzt registrieren' : 'Jetzt anmelden'}
            </Link>
          </p>

          <button type="button" onClick={onContinueAsGuest} disabled={Boolean(pending)}
            className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-sm font-bold text-white/60 underline decoration-white/30 underline-offset-4 hover:text-white disabled:opacity-50">
            Als Gast fortfahren
          </button>
          <p className="mt-1 text-center text-xs leading-5 text-white/45">Ohne Anmeldung die App entdecken. Echte Rennen benötigen ein Konto.</p>
          {loadError && <p role="status" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">Der bisherige Kontostatus konnte nicht geladen werden. Versuche deine Anmeldung erneut.</p>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs text-rose-100">{error}</p>}
          {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-100">{notice}</p>}
        </section>
        <p className="mt-5 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.055] p-3 text-[11px] leading-5 text-white/55">
          Du bleibst normalerweise im selben Browser angemeldet. In-App-Browser, private Tabs und andere Vorschau-Adressen teilen gespeicherte Anmeldungen nicht.
        </p>
        <p className="mt-5 flex gap-2 text-[11px] leading-5 text-white/40">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/70" aria-hidden="true" />
          Die Anmeldung erfolgt über Supabase Auth. Apple, Google und Facebook benötigen eine gesonderte Freischaltung.
        </p>
        <p className="mt-4 flex justify-center gap-2 text-[10px] font-semibold text-white/30">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Dein persönlicher Zugang
        </p>
      </div>
    </main>
  );
}
