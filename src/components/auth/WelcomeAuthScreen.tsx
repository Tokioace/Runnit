import { useState, type FormEvent } from 'react';
import {
  ArrowRight, CheckCircle2, ChevronLeft, Footprints,
  LockKeyhole, Mail, ShieldCheck, Sparkles, Timer, Users,
} from 'lucide-react';
import type { UseSupabaseUserReturn } from '../../hooks/useSupabaseUser';
import type { SocialProvider } from '../../lib/authRedirect';
import AccountAuthPanel from '../profile/AccountAuthPanel';

type Props = Pick<UseSupabaseUserReturn,
  'signInWithProvider' | 'sendMagicLink' | 'verifyEmailOtp' | 'signIn' | 'signUp' | 'loadError'
>;

type EmailMode = 'hidden' | 'magic-link' | 'password';

const providers: { id: SocialProvider; title: string; marker: string; style: string }[] = [
  { id: 'apple', title: 'Mit Apple fortfahren', marker: '', style: 'border-white/15 bg-white text-slate-950 hover:bg-white/90' },
  { id: 'google', title: 'Mit Google fortfahren', marker: 'G', style: 'border-white/15 bg-[#182033] text-white hover:bg-[#222e49]' },
  { id: 'facebook', title: 'Mit Facebook fortfahren', marker: 'f', style: 'border-blue-500/25 bg-[#15254b] text-white hover:bg-[#20376c]' },
];

function authErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message.toLowerCase() : '';
  if (detail.includes('provider') || detail.includes('unsupported') || detail.includes('disabled')) {
    return 'Dieser Anmeldeanbieter ist im Runnit-Backend noch nicht aktiviert.';
  }
  if (detail.includes('expired') || detail.includes('invalid token') || detail.includes('otp')) {
    return 'Dieser Code ist ungültig oder abgelaufen. Bitte fordere einen neuen Code an.';
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

export default function WelcomeAuthScreen({ signInWithProvider, sendMagicLink, verifyEmailOtp, signIn, signUp, loadError }: Props) {
  const [emailMode, setEmailMode] = useState<EmailMode>('hidden');
  const [email, setEmail] = useState('');
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    if (pending) return;
    setPending('email');
    setError(null);
    setNotice(null);
    try {
      await sendMagicLink(email);
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
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#090b13] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-36 -top-32 h-[26rem] w-[26rem] rounded-full bg-violet-600/25 blur-[95px]" />
        <div className="absolute -left-36 top-[26rem] h-[22rem] w-[22rem] rounded-full bg-cyan-500/10 blur-[80px]" />
        <div className="absolute inset-x-0 top-0 h-[30rem] opacity-25"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)',
            backgroundSize: '38px 38px',
            maskImage: 'linear-gradient(to bottom,black,transparent)',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-md">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-500/20 shadow-[0_0_32px_rgba(139,92,246,.2)]">
              <Footprints className="h-6 w-6 text-violet-200" aria-hidden="true" />
            </span>
            <span className="text-xl font-black tracking-[0.1em]">RUNNIT<span className="text-emerald-300">.</span></span>
          </div>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-bold tracking-wider text-white/55">BETA</span>
        </header>

        <section aria-labelledby="welcome-title" className="mt-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-bold tracking-wide text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> YOUR RUN STARTS HERE
          </span>
          <h1 id="welcome-title" className="mt-5 text-[clamp(2.8rem,12vw,4.3rem)] font-black leading-[1.01] tracking-[-0.065em]">
            BEREIT.<br />
            <span className="bg-gradient-to-r from-violet-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent">FÜR RUNNIT.</span>
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/65">
            Erstelle dein Konto in wenigen Schritten oder melde dich an.
            Danach wartet deine Sprint-Welt auf dich.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-semibold text-white/50">
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2"><Timer className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" /> Sprints</span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2"><Users className="h-3.5 w-3.5 text-violet-200" aria-hidden="true" /> Duelle</span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2"><Sparkles className="h-3.5 w-3.5 text-emerald-200" aria-hidden="true" /> Community</span>
          </div>
        </section>

        <section aria-label="Anmelden oder registrieren" className="mt-9 rounded-[30px] border border-violet-300/20 bg-gradient-to-br from-[#1c1a32] via-[#141727] to-[#101928] p-5 shadow-[0_20px_70px_rgba(0,0,0,.3)]">
          <div className="mb-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">SCHNELL STARTEN</p>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight">Konto erstellen oder anmelden</h2>
            <p className="mt-1.5 text-xs leading-5 text-white/55">Ein Konto für alle Runnit-Funktionen.</p>
          </div>

          {emailMode === 'hidden' ? (
            <div className="space-y-3">
              {providers.map(({ id, title, marker, style }) => (
                <button key={id} type="button" disabled={Boolean(pending)} onClick={() => { void startProvider(id); }}
                  className={`flex min-h-14 w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition-colors disabled:opacity-55 ${style}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl font-black ${id === 'apple' ? 'text-slate-950' : id === 'facebook' ? 'text-blue-400' : 'text-white'}`} aria-hidden="true">{marker}</span>
                  <span className="flex-1">{pending === id ? 'Weiterleitung …' : title}</span>
                  <ArrowRight className="h-4 w-4 opacity-55" aria-hidden="true" />
                </button>
              ))}
              <div className="flex items-center gap-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/35">
                <span className="h-px flex-1 bg-white/10" />oder<span className="h-px flex-1 bg-white/10" />
              </div>
              <button type="button" disabled={Boolean(pending)} onClick={openEmail}
                className="flex min-h-14 w-full items-center gap-4 rounded-2xl border border-violet-300/25 bg-violet-500/15 px-4 text-left text-sm font-extrabold text-white transition-colors hover:bg-violet-500/25 disabled:opacity-55">
                <Mail className="h-6 w-6 text-violet-200" aria-hidden="true" />
                <span className="flex-1">Mit E-Mail fortfahren</span>
                <ArrowRight className="h-4 w-4 text-white/60" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button type="button" disabled={Boolean(pending)} onClick={() => { setEmailMode('hidden'); setError(null); setNotice(null); }}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg text-xs font-semibold text-violet-200 hover:text-white">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Alle Anmeldearten
              </button>

              {emailMode === 'magic-link' ? (
                <>
                  <div>
                    <h3 className="text-lg font-extrabold">Ohne Passwort anmelden</h3>
                    <p className="mt-1 text-xs leading-5 text-white/55">Du erhältst einen Anmeldelink. Alternativ kannst du einen sechsstelligen Code direkt hier eingeben, sofern er in der E-Mail steht.</p>
                  </div>
                  <form onSubmit={event => { void submitEmail(event); }} className="space-y-3">
                    <label htmlFor="welcome-email" className="block text-xs font-bold text-white/70">Deine E-Mail-Adresse</label>
                    <input id="welcome-email" type="email" required autoComplete="email" inputMode="email"
                      disabled={Boolean(pending)} value={email} onChange={e => { setEmail(e.target.value); setVerificationEmail(null); setOtpCode(''); setNotice(null); }}
                      placeholder="name@beispiel.de"
                      className="min-h-14 w-full rounded-2xl border border-white/20 bg-[#0d1322] px-4 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-violet-300/50" />
                    <button type="submit" disabled={Boolean(pending)}
                      className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 text-sm font-extrabold text-white transition hover:brightness-110 disabled:opacity-50">
                      {pending === 'email' ? 'E-Mail wird angefordert …' : verificationEmail ? 'Neuen Link oder Code senden' : 'Anmeldelink senden'}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </form>
                  {verificationEmail && (
                    <form onSubmit={event => { void submitOtpCode(event); }} className="space-y-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
                      <p className="flex items-center gap-2 text-xs font-bold text-emerald-200">
                        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                        E-Mail angefordert
                      </p>
                      <label htmlFor="welcome-otp" className="block text-xs font-semibold text-white/75">Sechsstelliger E-Mail-Code (falls vorhanden)</label>
                      <input id="welcome-otp" name="one-time-code" type="text" inputMode="numeric"
                        autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
                        value={otpCode} disabled={Boolean(pending)}
                        onChange={event => setOtpCode(event.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="123456"
                        className="min-h-14 w-full rounded-2xl border border-emerald-300/20 bg-[#0d1322] px-4 text-center text-lg font-black tracking-[0.2em] text-white outline-none placeholder:text-white/20 focus:ring-2 focus:ring-emerald-300/50" />
                      <button type="submit" disabled={Boolean(pending) || otpCode.length !== 6}
                        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-extrabold text-slate-950 transition hover:brightness-110 disabled:opacity-50">
                        {pending === 'otp' ? 'Code wird geprüft …' : 'Mit Code anmelden'}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <p className="text-[11px] leading-5 text-white/50">Du kannst im selben Browser bleiben. Wenn deine Mail nur einen Link enthält, muss für den Code die Supabase-Mailvorlage ergänzt werden.</p>
                    </form>
                  )}
                  <button type="button" onClick={() => { setEmailMode('password'); setError(null); setNotice(null); }}
                    className="min-h-11 w-full rounded-xl text-center text-xs font-semibold text-cyan-200 hover:text-white">
                    Lieber mit E-Mail und Passwort anmelden?
                  </button>
                </>
              ) : (
                <>
                  <AccountAuthPanel signIn={signIn} signUp={signUp} />
                  <button type="button" onClick={() => { setEmailMode('magic-link'); setError(null); setNotice(null); }}
                    className="min-h-11 w-full rounded-xl text-center text-xs font-semibold text-cyan-200 hover:text-white">
                    Stattdessen einen Anmeldelink nutzen
                  </button>
                </>
              )}
            </div>
          )}

          {loadError && <p role="status" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">Der bisherige Kontostatus konnte nicht geladen werden. Versuche deine Anmeldung erneut.</p>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-rose-300/25 bg-rose-400/10 p-3 text-xs leading-5 text-rose-100">{error}</p>}
          {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-xs leading-6 text-emerald-100">{notice}</p>}
        </section>

        <p className="mt-6 flex items-start gap-2 text-xs leading-6 text-white/45">
          <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-300/70" aria-hidden="true" />
          Die Anmeldung erfolgt über Supabase und den gewählten Anbieter. Apple, Google und Facebook benötigen eine gesonderte Freischaltung im Runnit-Backend. Die App bleibt ohne Anmeldung geschlossen.
        </p>
        <div className="mt-7 flex items-center justify-center gap-2 text-[11px] font-semibold text-white/25">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Zugang nur mit eigenem Konto
        </div>
      </div>
    </main>
  );
}
