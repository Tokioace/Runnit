import { BarChart3, Flag, ShieldCheck, Timer, Trophy, UserRound, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageFrame from '../components/ui/PageFrame';
import AccountDetailsPanel from '../components/profile/AccountDetailsPanel';
import { useSupabaseUser } from '../hooks/useSupabaseUser';

const unavailableStats = [
  { label: 'Verifizierte Bestzeit', icon: Timer },
  { label: 'Gewertete Rennen', icon: Flag },
  { label: 'Bestätigte Siege', icon: Trophy },
  { label: 'Offizielle Platzierung', icon: BarChart3 },
];

export default function ProfileScreen() {
  const { user, loading, loadError, signOut, updateDisplayName } = useSupabaseUser();

  return (
    <PageFrame
      kicker="YOUR RUNNING STORY"
      title="Mein Profil."
      description="Dein Runnit-Konto – persönliche Leistungen werden erst mit einer belastbaren Datengrundlage angezeigt."
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
        <section aria-label="Gastprofil" className="space-y-5 rounded-3xl border border-violet-300/20 bg-gradient-to-br from-violet-500/10 to-white/[0.025] p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-500/15">
              <UserRound className="h-6 w-6 text-violet-200" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold">Du erkundest Runnit als Gast.</h2>
              <p className="mt-1 text-xs leading-5 text-white/60">Für die Vorschau ist kein Konto nötig.</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-white/65">
            Karte, Ranglisten und GPS-Testlabor sind verfügbar. Für das Veranstalten, Beitreten oder Starten eines Rennens musst du dich anmelden. Nach der Anmeldung kannst du hier deinen Anzeigenamen verwalten.
          </p>
          {loadError && <p role="status" className="text-xs leading-5 text-amber-200">Dein Kontostatus konnte gerade nicht geladen werden. Du kannst die App weiter als Gast erkunden.</p>}
          <Link to="/login?next=%2Fprofile" className="flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-3 text-sm font-extrabold text-white">
            Anmelden oder registrieren
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </section>
      )}
    </PageFrame>
  );
}
