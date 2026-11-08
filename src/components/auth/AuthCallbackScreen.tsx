import { ArrowRight, Footprints, LockKeyhole, RotateCcw, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { callbackHasError } from '../../lib/authRedirect';

/**
 * Callback has no access to raw identity-provider tokens, and never reflects
 * provider-supplied query-string details back into the DOM.
 */
export default function AuthCallbackScreen() {
  const denied = callbackHasError(window.location.search, window.location.hash);
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#090b13] px-5 py-10 text-white">
      <section className="w-full max-w-sm rounded-[28px] border border-violet-300/20 bg-gradient-to-br from-[#1b1a32] to-[#101726] p-6 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-300/30 bg-violet-400/15">
          {denied ? <ShieldAlert className="h-7 w-7 text-amber-300" aria-hidden="true" />
            : <LockKeyhole className="h-7 w-7 text-violet-200" aria-hidden="true" />}
        </div>
        <div className="mb-4 flex items-center justify-center gap-2">
          <Footprints className="h-5 w-5 text-violet-200" aria-hidden="true" />
          <span className="text-lg font-black tracking-[0.12em]">RUNNIT<span className="text-emerald-300">.</span></span>
        </div>
        <h1 className="text-xl font-extrabold">
          {denied ? 'Anmeldung nicht abgeschlossen' : 'Keine aktive Sitzung gefunden'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/60">
          {denied
            ? 'Die Anmeldung wurde abgebrochen oder der Anbieter hat die Anfrage abgelehnt. Bitte versuche es erneut.'
            : 'Der Anmeldelink hat keine gültige Sitzung erstellt. Möglicherweise ist er abgelaufen oder Supabase leitet noch zu einer falschen Adresse um. Versuche einen neuen Link oder einen Einmalcode.'}
        </p>
        <Link to="/login?next=%2Fmap" replace className="mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 text-sm font-extrabold">
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Erneut anmelden
          <ArrowRight className="ml-auto h-4 w-4" aria-hidden="true" />
        </Link>
        <Link to="/map" className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-semibold text-white/70">
          Karte als Gast erkunden
        </Link>
      </section>
    </main>
  );
}
