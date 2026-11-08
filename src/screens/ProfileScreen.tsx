import { Activity, ArrowRight, BarChart3, Flag, ShieldCheck, Timer, Trophy, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/ui/PageFrame';
import AccountAuthPanel from '../components/profile/AccountAuthPanel';
import AccountDetailsPanel from '../components/profile/AccountDetailsPanel';
import { useSupabaseUser } from '../hooks/useSupabaseUser';

const unavailableStats = [
  { label: 'Verifizierte Bestzeit', icon: Timer },
  { label: 'Gewertete Rennen', icon: Flag },
  { label: 'Bestätigte Siege', icon: Trophy },
  { label: 'Offizielle Platzierung', icon: BarChart3 },
];

export default function ProfileScreen() {
  const { user, loading, loadError, signIn, signUp, signOut, updateDisplayName } = useSupabaseUser();

  return (
    <PageFrame
      kicker="YOUR RUNNING STORY"
      title="Mein Profil."
      description={user
        ? 'Dein echtes Runnit-Konto – persönliche Leistungen werden erst mit einer belastbaren Datengrundlage angezeigt.'
        : 'Dein Weg zu Runnit beginnt hier. Erstelle ein Konto oder entdecke die App zunächst als Gast.'}
      icon={<UserRound className="h-7 w-7" aria-hidden="true" />}
    >
      {loading ? (
        <div role="status" className="flex min-h-52 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm font-semibold text-white/60">
          Kontostatus wird geladen …
        </div>
      ) : user ? (
        <>
          <AccountDetailsPanel user={user} updateDisplayName={updateDisplayName} signOut={signOut} />

          <section aria-label="Deine zukünftigen Sportstatistiken" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-extrabold tracking-tight">Sportliche Leistungen</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/45">Noch nicht verfügbar</span>
            </div>
            <p className="text-xs leading-6 text-white/55">
              Es sind noch keine geprüften Laufdaten mit diesem Profil verbunden. Statt erfundener Rekorde und Medaillen zeigen wir bewusst keine Werte an.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {unavailableStats.map(({ label, icon: Icon }) => (
                <div key={label} className="flex min-h-32 flex-col justify-between rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-4">
                  <Icon className="h-5 w-5 text-violet-300" aria-hidden="true" />
                  <div>
                    <p className="text-2xl font-black tabular-nums text-white/55">—</p>
                    <p className="mt-1 text-[11px] leading-5 text-white/50">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.065] p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
            <p className="text-xs leading-6 text-white/65">
              Dein Konto ist mit Supabase Auth verbunden. Das bestätigt noch keine GPS-Leistung, Identität oder Berechtigung zur offiziellen Rangliste.
            </p>
          </div>
        </>
      ) : (
        <>
          {loadError && (
            <div role="status" className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.075] p-4 text-sm leading-6 text-amber-100">
              Der Kontostatus konnte nicht geladen werden. Prüfe deine Verbindung und lade die Seite erneut, falls du bereits angemeldet bist.
            </div>
          )}
          <AccountAuthPanel signIn={signIn} signUp={signUp} />
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">OHNE KONTO TESTEN</p>
            <h2 className="mt-2 text-lg font-extrabold">Erst mal entdecken?</h2>
            <p className="mt-2 text-xs leading-6 text-white/55">
              Die Karte und das GPS-Simulationslabor kannst du auch als Gast erkunden. Demospiele und Beispielwerte sind nicht offiziell verifiziert.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link to="/map" className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-violet-300/25 bg-violet-400/10 px-3 text-xs font-bold text-violet-100">
                <Activity className="h-4 w-4" aria-hidden="true" /> Zur Karte
              </Link>
              <Link to="/gps-lab" className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 text-xs font-bold text-emerald-100">
                GPS-Labor <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </>
      )}
    </PageFrame>
  );
}
