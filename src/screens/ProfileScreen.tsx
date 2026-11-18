import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, ChevronRight, Flag, Ruler, Settings, ShieldCheck, Trophy, UserRound } from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import AccountDetailsPanel from '../components/profile/AccountDetailsPanel';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { supabase } from '../lib/supabaseClient';

/** Profile owns identity, privacy, preferences and calibration.
 * Competition metrics live in Stats, and the rankings live in Leaderboard. */
export default function ProfileScreen() {
  const { user, loading, loadError, signOut, updateDisplayName, changePassword } = useSupabaseUser();
  const [optedIn, setOptedIn] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentReload, setConsentReload] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setOptedIn(false); setConsentLoading(false); return;
    }
    let mounted = true;
    setConsentLoading(true);
    setConsentError(null);
    void supabase.from('users').select('leaderboard_opt_in')
      .eq('id', user.id).maybeSingle().then(({ data, error }) => {
        if (!mounted) return;
        if (error) setConsentError('Deine Ranglisten-Einstellung konnte nicht geladen werden.');
        else setOptedIn(data?.leaderboard_opt_in === true);
        setConsentLoading(false);
      });
    return () => { mounted = false; };
  }, [user?.id, consentReload]);

  async function updateOptIn(next: boolean) {
    if (!user?.id || consentSaving || consentLoading) return;
    setConsentSaving(true); setConsentError(null);
    try {
      const { data, error } = await supabase.from('users')
        .update({ leaderboard_opt_in: next }).eq('id', user.id)
        .select('leaderboard_opt_in').single();
      if (error || !data || data.leaderboard_opt_in !== next) throw error || new Error('Update not confirmed');
      setOptedIn(next);
    } catch {
      setConsentError('Ranglisten-Freigabe konnte nicht gespeichert werden. Bitte erneut versuchen.');
    } finally {
      setConsentSaving(false);
    }
  }

  const displayName = loading ? 'WIRD GELADEN' : user?.displayName || 'GAST';
  return (
    <main className="runnit-game-home runnit-profile-master relative min-h-[100dvh] w-full max-w-full overflow-x-clip text-white">
      <div className="runnit-profile-content relative z-10 mx-auto w-full max-w-[620px] space-y-4 px-3 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] pt-[max(10px,env(safe-area-inset-top,0px))] sm:px-5">
        <header className="runnit-profile-hero" aria-label="Dein RUNNIT Profil">
          <div className="runnit-profile-hero-head flex items-center justify-between gap-3">
            <Link to="/home" aria-label="Zurück zur Startseite" className="runnit-profile-back"><ChevronRight className="h-6 w-6 rotate-180"/></Link>
            <img src="/runnit-metal-logo.svg" alt="RUNNIT" width={240} height={60} className="runnit-profile-logo"/>
            <a href="#konto" aria-label="Zu den Kontoeinstellungen" className="runnit-profile-settings"><Settings className="h-5 w-5"/></a>
          </div>
          <div className="runnit-profile-hero-character" aria-hidden="true"/>
          <div className="runnit-profile-player">
            <UserRound className="runnit-profile-crown" aria-hidden="true"/>
            <p className="runnit-profile-player-name">{displayName}</p>
            <p className="mt-2 text-xs font-black tracking-[0.1em] text-cyan-200">{user ? 'ANGEMELDETER RUNNER' : 'GASTMODUS'}</p>
          </div>
        </header>

        <section className="runnit-profile-panel space-y-3 p-4" aria-labelledby="profile-links">
          <h1 id="profile-links" className="runnit-profile-extra-title"><Flag className="h-5 w-5"/> DEIN RUNNIT</h1>
          <p className="text-xs leading-5 text-white/65">Persönliche Ergebnisse und Wettbewerb haben eigene Seiten, damit nichts doppelt erscheint.</p>
          <Link to="/stats" className="runnit-profile-action"><Activity className="h-5 w-5"/> MEINE LÄUFE & BESTZEITEN <ArrowRight className="h-4 w-4"/></Link>
          <Link to="/leaderboard" className="runnit-profile-action"><Trophy className="h-5 w-5"/> BETA-RANGLISTE <ArrowRight className="h-4 w-4"/></Link>
        </section>

        <section className="runnit-profile-panel space-y-3 p-4" aria-labelledby="visibility-title">
          <h2 id="visibility-title" className="runnit-profile-extra-title"><ShieldCheck className="h-5 w-5"/> RANGLISTEN-DATENSCHUTZ</h2>
          <p className="text-xs leading-5 text-white/70">
            Deine Zeiten werden privat in deinen Stats gespeichert. Nur wenn du zustimmst, werden
            dein RUNNIT-Name, deine Bestzeit, Siege und Anzahl abgeschlossener Duelle öffentlich in der Beta-Rangliste angezeigt – auch für Gäste.
            Die Rohdaten deiner GPS-/IMU-Messung werden nicht veröffentlicht.
          </p>
          {!user ? (
            <Link to="/login?next=%2Fprofile" className="runnit-profile-action">ANMELDEN FÜR RANGLISTEN-FREIGABE <ArrowRight className="h-4 w-4"/></Link>
          ) : (
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-cyan-300/25 bg-[#091a36]/85 px-3 py-2 text-xs font-black">
              <span>{consentLoading ? 'WIRD GELADEN …' : optedIn ? 'MEINE ZEITEN SIND SICHTBAR' : 'MEINE ZEITEN BLEIBEN PRIVAT'}</span>
              <input type="checkbox" checked={optedIn} disabled={consentLoading || consentSaving || Boolean(consentError)}
                onChange={e => { void updateOptIn(e.currentTarget.checked); }}
                aria-label="Meine Rennleistungen in der Beta-Rangliste veröffentlichen"
                className="h-6 w-6 accent-lime-400"/>
            </label>
          )}
          {consentSaving && <p role="status" className="text-xs text-cyan-100">ÄNDERUNG WIRD GESPEICHERT …</p>}
          {consentError && <div role="alert" className="text-xs text-amber-200">{consentError}
            <button type="button" className="ml-2 underline" onClick={() => setConsentReload(n => n + 1)}>ERNEUT VERSUCHEN</button>
          </div>}
          <p className="text-[11px] leading-5 text-cyan-100/60">
            Der Vergleich verwendet ausschließlich vollständig gespeicherte Duelle.
            Die Beta-Zeiten sind noch nicht unabhängig gegen Manipulation geprüft.
          </p>
        </section>

        <section id="konto" className="runnit-profile-account-section" aria-labelledby="account-title">
          <h2 id="account-title" className="runnit-profile-extra-title"><Settings className="h-5 w-5"/> KONTO & EINSTELLUNGEN</h2>
          {loading ? (
            <div role="status" className="runnit-profile-panel flex min-h-32 items-center justify-center text-sm text-white/70">Kontostatus wird geladen …</div>
          ) : user ? (
            <AccountDetailsPanel user={user} updateDisplayName={updateDisplayName} changePassword={changePassword} signOut={signOut}/>
          ) : (
            <div className="runnit-profile-panel space-y-3 p-5">
              <p className="text-sm font-bold text-cyan-100">Du erkundest RUNNIT als Gast.</p>
              {loadError && <p role="alert" className="text-xs text-amber-200">Dein Kontostatus konnte nicht geladen werden.</p>}
              <Link to="/login?next=%2Fprofile" className="runnit-profile-action runnit-profile-action-lime">ANMELDEN / REGISTRIEREN <ArrowRight className="h-5 w-5"/></Link>
            </div>
          )}
        </section>

        <section className="runnit-profile-panel" aria-label="Schrittlängenkalibrierung">
          <h2 className="runnit-profile-extra-title"><Ruler className="h-5 w-5"/> SCHRITTLÄNGE</h2>
          {user?.walkingCalibration ? (
            <p className="mt-3 text-xs leading-5 text-cyan-100/75">{(user.walkingCalibration.walkingStrideM*100).toFixed(1)} cm pro Gehschritt · experimentell, nicht für Wettkämpfe gewertet.</p>
          ) : <p className="mt-3 text-xs text-white/65">Noch keine Schrittlänge kalibriert.</p>}
          <Link to="/calibration" className="runnit-profile-action">KALIBRIERUNG ÖFFNEN <ArrowRight className="h-4 w-4"/></Link>
        </section>

        <section className="runnit-profile-panel" aria-label="Entwicklungslabore">
          <h2 className="runnit-profile-extra-title"><Activity className="h-5 w-5"/> TESTLABORE</h2>
          <p className="mt-2 text-xs text-white/65">Diagnosewerkzeuge werden nicht als Wettkampfergebnisse gewertet.</p>
          <div className="mt-3 space-y-2">
            <Link to="/gps-lab" className="runnit-profile-action">SCHRITTZÄHLER TEST <ArrowRight className="h-4 w-4"/></Link>
            <Link to="/fusion-lab" className="runnit-profile-action">GPS × IMU FUSION <ArrowRight className="h-4 w-4"/></Link>
            <Link to="/sprint-lab" className="runnit-profile-action">SPRINT-SIMULATION · DEMO <ArrowRight className="h-4 w-4"/></Link>
          </div>
        </section>
      </div>
      <BottomNav/>
    </main>
  );
}

