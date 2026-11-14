import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowRight, Award, ChevronRight, Crown, Flame, Flag, Footprints,
  Ghost, MapPin, Medal, Ruler, Settings, ShieldCheck, Timer,
  Trophy, UserRound, Zap,
} from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import AccountDetailsPanel from '../components/profile/AccountDetailsPanel';
import { useSupabaseUser } from '../hooks/useSupabaseUser';

const resultCards = [
  { title: 'RENNEN', subtitle: 'Verifizierte Läufe', Icon: Flag },
  { title: 'SIEGE', subtitle: 'Bestätigte Duelle', Icon: Trophy },
  { title: 'BESTZEIT', subtitle: '100 m · verifiziert', Icon: Timer },
] as const;

const goalCards = [
  { title: 'SCHRITTE', unit: '', Icon: Footprints, hue: 'cyan' },
  { title: 'DISTANZ', unit: 'km', Icon: MapPin, hue: 'lime' },
  { title: 'KALORIEN', unit: 'kcal', Icon: Flame, hue: 'pink' },
] as const;

const futureBadges = [
  { name: 'SPRINTER', label: 'Zeit noch nicht bestätigt', Icon: Zap, hue: 'cyan' },
  { name: 'CITY RUNNER', label: 'Rennen noch nicht geprüft', Icon: MapPin, hue: 'blue' },
  { name: 'SIEGESSERIE', label: 'Siege noch nicht geprüft', Icon: Crown, hue: 'gold' },
  { name: 'GHOST MASTER', label: 'Ghost-Runs noch nicht geprüft', Icon: Ghost, hue: 'violet' },
  { name: 'CHALLENGER', label: 'Challenges noch nicht geprüft', Icon: Award, hue: 'lime' },
] as const;

export default function ProfileScreen() {
  const { user, loading, loadError, signOut, updateDisplayName, changePassword } = useSupabaseUser();
  const displayName = loading ? 'WIRD GELADEN' : user?.displayName || 'GAST';
  const [selectedTab, setSelectedTab] = useState<'profil' | 'ziele' | 'erfolge'>('profil');

  return (
    <main className="runnit-game-home runnit-profile-master relative min-h-[100dvh] w-full max-w-full overflow-x-clip text-white">
      <div className="runnit-profile-content relative z-10 mx-auto w-full max-w-[620px] space-y-4 px-3 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] pt-[max(10px,env(safe-area-inset-top,0px))] sm:px-5">
        <header className="runnit-profile-hero" aria-label="Dein RUNNIT Profil">
          <div className="runnit-profile-hero-head flex items-center justify-between gap-3">
            <Link to="/home" aria-label="Zurück zu Home" className="runnit-profile-back"><ChevronRight className="h-6 w-6 rotate-180" aria-hidden="true" /></Link>
            <img src="/runnit-metal-logo.svg" alt="RUNNIT" width={240} height={60} className="runnit-profile-logo" />
            <a href="#konto" aria-label="Zu den Kontoeinstellungen" className="runnit-profile-settings"><Settings className="h-5 w-5" aria-hidden="true" /></a>
          </div>
          <div className="runnit-profile-hero-character" aria-hidden="true" />
          <div className="runnit-profile-player">
            <Crown className="runnit-profile-crown" aria-hidden="true" />
            <p className="runnit-profile-player-name">{displayName}</p>
            <p className="runnit-profile-level">LV. —</p>
            <div className="runnit-profile-xp" role="img" aria-label="XP-Fortschritt noch nicht verfügbar"><span /></div>
            <p className="runnit-profile-xp-label">XP NOCH NICHT VERFÜGBAR</p>
          </div>
        </header>

        <nav className="runnit-profile-tabs grid grid-cols-3 gap-1.5" aria-label="Profilbereiche">
          <a href="#profil" onClick={() => setSelectedTab('profil')} aria-current={selectedTab === 'profil' ? 'location' : undefined} className={'runnit-profile-tab' + (selectedTab === 'profil' ? ' runnit-profile-tab-active' : '')}><UserRound aria-hidden="true" /><span>PROFIL</span></a>
          <a href="#ziele" onClick={() => setSelectedTab('ziele')} aria-current={selectedTab === 'ziele' ? 'location' : undefined} className={'runnit-profile-tab' + (selectedTab === 'ziele' ? ' runnit-profile-tab-active' : '')}><Medal aria-hidden="true" /><span>ZIELE</span></a>
          <a href="#erfolge" onClick={() => setSelectedTab('erfolge')} aria-current={selectedTab === 'erfolge' ? 'location' : undefined} className={'runnit-profile-tab' + (selectedTab === 'erfolge' ? ' runnit-profile-tab-active' : '')}><Trophy aria-hidden="true" /><span>ERFOLGE</span></a>
        </nav>

        <section id="profil" aria-labelledby="profile-stats-title">
          <h1 id="profile-stats-title" className="sr-only">Spielerprofil und sportliche Leistungen</h1>
          <div className="runnit-profile-result-grid grid grid-cols-3 gap-2">
            {resultCards.map(({ title, subtitle, Icon }) => (
              <div key={title} className="runnit-profile-result">
                <Icon aria-hidden="true" />
                <strong>—</strong>
                <div><h2>{title}</h2><p>{subtitle}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section id="ziele" className="runnit-profile-panel" aria-labelledby="profile-week-title">
          <div className="runnit-profile-section-head">
            <h2 id="profile-week-title">WOCHENFORTSCHRITT <span aria-hidden="true">///</span></h2>
            <Link to="/stats" aria-label="Vollständige Statistiken ansehen" className="runnit-profile-section-link">DIESE WOCHE <ChevronRight aria-hidden="true" /></Link>
          </div>
          <div className="runnit-profile-goal-grid grid grid-cols-3 gap-2">
            {goalCards.map(({ title, unit, Icon, hue }) => (
              <div key={title} className="runnit-profile-goal">
                <div className={'runnit-profile-goal-ring runnit-profile-ring-' + hue} role="img" aria-label={title + ': kein Fortschritt ermittelt'}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <strong>—</strong><small>{unit || 'SCHRITTE'}</small>
                </div>
                <strong>{title}</strong><span>KEINE DATEN</span>
              </div>
            ))}
          </div>
          <p className="runnit-profile-empty-note">Die Wochenwerte sind noch nicht mit einer verlässlichen Messdatenquelle verbunden.</p>
        </section>

        <section id="erfolge" className="runnit-profile-panel" aria-labelledby="achievements-title">
          <div className="runnit-profile-section-head">
            <h2 id="achievements-title"><Trophy className="h-5 w-5" aria-hidden="true" /> ERFOLGE</h2>
            <span className="runnit-profile-section-label">VORSCHAU</span>
          </div>
          <div className="runnit-profile-badges grid grid-cols-5 gap-1.5">
            {futureBadges.map(({ name, label, Icon, hue }) => (
              <div key={name} className="runnit-profile-badge" aria-label={name + ': ' + label}>
                <span className={'runnit-profile-badge-hex runnit-profile-badge-' + hue}><Icon aria-hidden="true" /></span>
                <strong>{name}</strong><small>NOCH GESPERRT</small>
              </div>
            ))}
          </div>
          <p className="runnit-profile-empty-note">Abzeichen sind noch nicht vergeben. Die farbigen Symbole zeigen ausschließlich die geplante Darstellung.</p>
        </section>

        <section id="konto" className="runnit-profile-account-section" aria-labelledby="account-title">
          <h2 id="account-title" className="runnit-profile-extra-title"><Settings className="h-5 w-5" aria-hidden="true" /> KONTO & EINSTELLUNGEN</h2>
          {loading ? (
            <div role="status" className="runnit-profile-panel flex min-h-32 items-center justify-center text-sm text-white/70">Kontostatus wird geladen …</div>
          ) : user ? (
            <AccountDetailsPanel user={user} updateDisplayName={updateDisplayName} changePassword={changePassword} signOut={signOut} />
          ) : (
            <div aria-label="Gastprofil" className="runnit-profile-panel space-y-3 p-5">
              <p className="text-sm font-bold text-cyan-100">Du erkundest Runnit als Gast.</p>
              <p className="text-xs leading-5 text-white/70">Karte, Rangliste und Testlabor kannst du ohne Konto erkunden. Für Rennen musst du dich anmelden.</p>
              {loadError && <p role="status" className="text-xs text-amber-200">Dein Kontostatus konnte nicht geladen werden. Der Gastmodus bleibt verfügbar.</p>}
              <Link to="/login?next=%2Fprofile" className="runnit-profile-action runnit-profile-action-lime">ANMELDEN / REGISTRIEREN <ArrowRight className="h-5 w-5" aria-hidden="true" /></Link>
            </div>
          )}
        </section>

        <section className="runnit-profile-panel" aria-label="Individuelle Gehschrittlänge">
          <h2 className="runnit-profile-extra-title"><Ruler className="h-5 w-5" aria-hidden="true" /> SCHRITTLÄNGE</h2>
          {user?.walkingCalibration ? (
            <>
              <p className="mt-3 text-2xl font-black italic text-cyan-200">{(user.walkingCalibration.walkingStrideM * 100).toFixed(1)} cm <span className="text-xs font-semibold text-white/60">pro Gehschritt</span></p>
              <p className="mt-2 text-xs leading-5 text-white/60">Körpergröße: {user.walkingCalibration.heightCm} cm · {user.walkingCalibration.stepCount} Schritte · experimentelle GPS-Endpunktmessung. Nicht für Sprintwertungen verwendet.</p>
            </>
          ) : <p className="mt-3 text-xs leading-5 text-white/65">Noch keine persönliche Schrittlänge gespeichert.</p>}
          <Link to="/calibration" className="runnit-profile-action">{user?.walkingCalibration ? 'KALIBRIERUNG WIEDERHOLEN' : 'SCHRITTLÄNGE KALIBRIEREN'} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </section>

        <section className="runnit-profile-panel" aria-label="Entwicklungslabore">
          <h2 className="runnit-profile-extra-title"><Activity className="h-5 w-5" aria-hidden="true" /> RUNNIT ENGINEERING</h2>
          <p className="mt-2 text-xs leading-5 text-white/65">Experimente sind keine offiziellen Wettkämpfe und beeinflussen keine Rangliste.</p>
          <div className="runnit-profile-lab-links mt-3 space-y-2">
            <Link to="/fusion-lab" className="runnit-profile-action"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> GPS × IMU FUSION <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            <Link to="/sprint-lab" className="runnit-profile-action"><Flag className="h-4 w-4" aria-hidden="true" /> SPRINT ARENA · DEMO <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
        </section>

        <div className="runnit-profile-trust flex gap-2">
          <ShieldCheck className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden="true" />
          <p>Es gibt noch keine geprüften Laufdaten. Ein RUNNIT-Konto ist kein Identitäts- oder Leistungsnachweis. Verifizierte Rennleistungen werden erst nach zuverlässiger Prüfung berücksichtigt.</p>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
