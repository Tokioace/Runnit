import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowLeft, Copy, Dna,
  Dumbbell, Footprints, Gauge,
  Pencil, Settings, ShieldCheck, Shirt,
  Target, Trophy, UserRound, Zap,
} from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import AccountDetailsPanel from '../components/profile/AccountDetailsPanel';
import type { UseSupabaseUserReturn } from '../hooks/useSupabaseUser';
import LegalLinks from '../components/legal/LegalLinks';
import { supabase } from '../lib/supabaseClient';
import { useRunnerHistory } from '../hooks/useRunnerHistory';
import { formatRaceTime } from '../lib/runnerHistory';
import '../styles/profileY2k.css';
import '../styles/profileHub.css';

/**
 * Runner profile: all customizations are private Supabase Auth user metadata.
 * This data never authorizes actions and is not published in leaderboards.
 * Public ranking consent remains in public.users.leaderboard_opt_in.
 */
type Avatar = 'original' | 'arcade' | 'classic';
type RunnerProfile = {
  birthYear: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  avatar: Avatar;
  bio: string;
  focus: string;
  focusDone: boolean;
  runningStyle: string;
  shoeType: string;
};
type Pane = 'account' | 'privacy' | 'editor' | 'dna' | 'equipment' | 'training' | 'goals' | 'badges' | 'bio' | null;
type Performance = { speed: number | null; acceleration: number | null; stride: number | null; cadence: number | null };
type SpeedRow = {
  max_speed_mps?: number | null;
  max_accel_mps2?: number | null;
  step_length_m_avg?: number | null;
  steps_count?: number | null;
  time_ms?: number | null;
  elapsed_ms?: number | null;
};
const EMPTY_PROFILE: RunnerProfile = {
  birthYear: '', gender: '', heightCm: '', weightKg: '',
  avatar: 'original', bio: '', focus: '', focusDone: false,
  runningStyle: '', shoeType: '',
};
const EMPTY_PERFORMANCE: Performance = { speed: null, acceleration: null, stride: null, cadence: null };
const avatarImages: Record<Avatar, string> = {
  original: '/runnit-profile-avatar.avif',
  arcade: '/runnit-home-half-face-v2.avif',
  classic: '/runnit-launch-portrait.avif',
};
const avatarNames: Record<Avatar, string> = {
  original: 'ORIGINAL', arcade: 'ARCADE', classic: 'CLASSIC',
};
const labelForPane: Record<Exclude<Pane, null>, string> = {
  account: 'KONTO & EINSTELLUNGEN',
  privacy: 'PRIVATSPHÄRE',
  editor: 'RUNNER EDITOR',
  dna: 'RUNNER-DNA',
  equipment: 'AUSRÜSTUNG',
  training: 'TRAINING',
  goals: 'ZIELE & FOKUS',
  badges: 'BADGES',
  bio: 'RUNNER-BIO',
};
function profileFromMetadata(metadata: unknown): RunnerProfile {
  if (!metadata || typeof metadata !== 'object') return { ...EMPTY_PROFILE };
  const raw = (metadata as Record<string, unknown>).runnit_profile_v1;
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PROFILE };
  const data = raw as Record<string, unknown>;
  const str = (key: keyof RunnerProfile, max: number) =>
    typeof data[key] === 'string' ? (data[key] as string).slice(0, max) : '';
  const avatar = data.avatar;
  return {
    birthYear: str('birthYear', 4),
    gender: str('gender', 24),
    heightCm: str('heightCm', 6),
    weightKg: str('weightKg', 6),
    avatar: avatar === 'arcade' || avatar === 'classic' ? avatar : 'original',
    bio: str('bio', 180),
    focus: str('focus', 100),
    focusDone: data.focusDone === true,
    runningStyle: str('runningStyle', 40),
    shoeType: str('shoeType', 40),
  };
}
function positiveMetric(value: unknown, max: number, min = 0): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > min && value <= max ? value : null;
}
function largest(values: (number | null)[]): number | null {
  const measured = values.filter((n): n is number => n !== null);
  return measured.length ? Math.max(...measured) : null;
}
function formatMetric(value: number | null, unit: string, precision = 1): string {
  return value === null ? '—' : value.toFixed(precision).replace('.', ',') + ' ' + unit;
}
function bmiFor(profile: RunnerProfile): number | null {
  const height = Number(profile.heightCm.replace(',', '.')) / 100;
  const weight = Number(profile.weightKg.replace(',', '.'));
  return Number.isFinite(height) && height >= .8 && height <= 2.5 &&
    Number.isFinite(weight) && weight >= 20 && weight <= 300 ?
    weight / (height * height) : null;
}
function validateProfile(p: RunnerProfile): string | null {
  const height = Number(p.heightCm.replace(',', '.'));
  const weight = Number(p.weightKg.replace(',', '.'));
  const year = Number(p.birthYear);
  if (p.heightCm && (!Number.isFinite(height) || height < 80 || height > 250))
    return 'Die Größe muss zwischen 80 und 250 cm liegen.';
  if (p.weightKg && (!Number.isFinite(weight) || weight < 20 || weight > 300))
    return 'Das Gewicht muss zwischen 20 und 300 kg liegen.';
  if (p.birthYear && (!/^\d{4}$/.test(p.birthYear) || year < 1900 || year > new Date().getFullYear()))
    return 'Bitte gib ein gültiges Geburtsjahr ein.';
  if (p.bio.length > 180 || p.focus.length > 100) return 'Text ist zu lang.';
  return null;
}
type HubSection = 'identity' | 'style' | 'dna' | 'training' | 'badges';
const hubSections = [
  { id: 'identity', label: 'IDENTITÄT', Icon: UserRound },
  { id: 'style', label: 'STYLE', Icon: Shirt },
  { id: 'dna', label: 'DNA', Icon: Dna },
  { id: 'training', label: 'TRAINING', Icon: Dumbbell },
  { id: 'badges', label: 'BADGES', Icon: Trophy },
] as const;

export default function ProfileScreen({ auth }: { auth: UseSupabaseUserReturn }) {
  const { user, loading, signOut, updateDisplayName, changePassword, beginAccountMutation } = auth;
  const history = useRunnerHistory(user?.id);
  const [profile, setProfile] = useState<RunnerProfile>({ ...EMPTY_PROFILE });
  const [draft, setDraft] = useState<RunnerProfile>({ ...EMPTY_PROFILE });
  const [profileLoading, setProfileLoading] = useState(false);
  const [performance, setPerformance] = useState<Performance>(EMPTY_PERFORMANCE);
  const [performanceError, setPerformanceError] = useState(false);
  const [pane, setPane] = useState<Pane>(null);
  const [activeSection, setActiveSection] = useState<HubSection>('identity');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [optedIn, setOptedIn] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState('');

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setProfile({ ...EMPTY_PROFILE });
      setDraft({ ...EMPTY_PROFILE });
      setPerformance(EMPTY_PERFORMANCE);
      setPerformanceError(false);
      setOptedIn(false);
      setProfileLoading(false);
      setConsentLoading(false);
      setConsentError('');
      return;
    }
    // Never show the previous signed-in runner's private information while
    // a newly authenticated session is loading.
    setProfile({ ...EMPTY_PROFILE });
    setDraft({ ...EMPTY_PROFILE });
    setPerformance(EMPTY_PERFORMANCE);
    setOptedIn(false);
    setConsentError('');
    setProfileLoading(true);
    setConsentLoading(true);
    setPerformanceError(false);
    void (async () => {
      const [identity, duels, ghosts, consent] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('duel_results').select('max_speed_mps,max_accel_mps2,step_length_m_avg,steps_count,time_ms')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
        supabase.from('ghost_run_sessions').select('max_speed_mps,steps_count,elapsed_ms')
          .eq('user_id', user.id).eq('run_state', 'finished').order('created_at', { ascending: false }).limit(200),
        supabase.from('users').select('leaderboard_opt_in').eq('id', user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (!identity.error && identity.data.user?.id === user.id) {
        const loaded = profileFromMetadata(identity.data.user.user_metadata);
        setProfile(loaded);
        setDraft(loaded);
      }
      setProfileLoading(false);
      if (consent.error) setConsentError('Datenschutz-Einstellung konnte nicht geladen werden.');
      else { setConsentError(''); setOptedIn(consent.data?.leaderboard_opt_in === true); }
      setConsentLoading(false);
      if (duels.error || ghosts.error) { setPerformanceError(true); return; }
      const duelRows = (duels.data ?? []) as SpeedRow[];
      const ghostRows = (ghosts.data ?? []) as SpeedRow[];
      const validSpeed = (n: unknown) => positiveMetric(n, 12.5, .2);
      const cadence = duelRows.map(row => {
        const steps = positiveMetric(row.steps_count, 100000);
        const time = positiveMetric(row.time_ms, 3600000);
        return steps !== null && time !== null ? positiveMetric(steps * 60000 / time, 300, 25) : null;
      });
      setPerformance({
        speed: largest([...duelRows, ...ghostRows].map(row => validSpeed(row.max_speed_mps))),
        acceleration: largest(duelRows.map(row => positiveMetric(row.max_accel_mps2, 15, .1))),
        stride: largest(duelRows.map(row => positiveMetric(row.step_length_m_avg, 3, .2))),
        cadence: largest(cadence),
      });
    })();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!pane) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setPane(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pane, saving]);

  const open = (next: Exclude<Pane, null>) => {
    setDraft({ ...profile });
    setError(null);
    setNotice('');
    setPane(next);
  };
  const saveProfile = useCallback(async (next: RunnerProfile) => {
    if (!user?.id) { setError('Melde dich an, um dein Profil zu speichern.'); return false; }
    const validation = validateProfile(next);
    if (validation) { setError(validation); return false; }
    if (saving) return false;
    setSaving(true); setError(null);
    try {
      const assertCurrent = beginAccountMutation();
      const { data: identity, error: authError } = await supabase.auth.getUser();
      assertCurrent();
      if (authError || identity.user?.id !== user.id) throw new Error('session');
      const { data, error: saveError } = await supabase.auth.updateUser({
        data: { runnit_profile_v1: next },
      });
      assertCurrent();
      if (saveError || data.user?.id !== user.id) throw saveError || new Error('profile');
      setProfile(next); setDraft(next); setNotice('Profil gespeichert.');
      return true;
    } catch {
      setError('Speichern fehlgeschlagen. Bitte prüfe deine Anmeldung.');
      return false;
    } finally { setSaving(false); }
  }, [user?.id, saving, beginAccountMutation]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await saveProfile(draft)) setPane(null);
  }
  async function saveConsent(next: boolean) {
    if (!user?.id || consentSaving || consentLoading) return;
    setConsentSaving(true); setConsentError('');
    try {
      const assertCurrent = beginAccountMutation();
      const { data, error: updateError } = await supabase.from('users')
        .update({ leaderboard_opt_in: next }).eq('id', user.id)
        .select('leaderboard_opt_in').single();
      assertCurrent();
      if (updateError || data?.leaderboard_opt_in !== next) throw updateError || new Error('not confirmed');
      setOptedIn(next);
    } catch {
      setConsentError('Speichern nicht möglich. Bitte erneut versuchen.');
    } finally { setConsentSaving(false); }
  }
  async function toggleGoal() {
    if (!profile.focus.trim()) { open('goals'); return; }
    await saveProfile({ ...profile, focusDone: !profile.focusDone });
  }
  const bmi = useMemo(() => bmiFor(profile), [profile]);
  const name = loading ? 'LADEN …' : user?.displayName || 'GAST';
  const avatar = avatarImages[profile.avatar];
  const isGuest = !user;
  const copyRunnerId = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setNotice('Runner-ID kopiert.');
    } catch {
      setNotice('Kopieren nicht möglich. Bitte nutze die Kontoeinstellungen.');
    }
  };
  const historyAvailable = Boolean(user) && !history.loading && !history.error;
  const completedDuels = historyAvailable ? String(history.totals.completedDuels) : '—';
  const best50 = historyAvailable ? formatRaceTime(history.totals.best50Ms) : '—';
  const speedLabel = formatMetric(performance.speed === null ? null : performance.speed * 3.6, 'km/h');
  const accelerationLabel = formatMetric(performance.acceleration, 'm/s²', 2);
  const strideLabel = formatMetric(performance.stride, 'm', 2);
  const cadenceLabel = formatMetric(performance.cadence, 'spm', 0);
  return (
    <main className="rp-screen rp-hub">
      <div className="rp-background" aria-hidden="true" />
      <div className="rp-stage rp-hub-layout">

        <header className="rp-hub-topbar" aria-label="RUNNIT Profil">
          <Link to="/home" className="rp-hub-top-action" aria-label="Zurück zu Home"><ArrowLeft aria-hidden="true" /></Link>
          <img src="/runnit-metal-logo.svg" alt="RUNNIT" className="rp-hub-logo" />
          <span className="rp-hub-heading">PROFIL</span>
          <button type="button" className="rp-hub-top-action" onClick={() => open('account')} aria-label="Kontoeinstellungen öffnen"><Settings aria-hidden="true" /></button>
        </header>

        <section className="rp-hub-identity" aria-label="Runner-Identität">
          <img src={avatar} alt="Dein gewähltes Runner-Profilbild" className="rp-hub-avatar" />
          <div className="rp-hub-identity-info">
            <strong className="rp-hub-name">{name}</strong>
            <span>{user ? 'ANGEMELDETER RUNNER' : 'GASTMODUS'}</span>
          </div>
          <button type="button" className="rp-hub-icon-button" onClick={() => open('editor')} aria-label="Profilbild bearbeiten"><Pencil aria-hidden="true" /></button>
        </section>


        <section className="rp-hub-hero" aria-label="Runner-Scan mit sechs echten Leistungswerten">
          <svg className="rp-hub-lines" viewBox="0 0 360 400" preserveAspectRatio="none"
            focusable="false" aria-hidden="true">
            <polyline points="89,77 121,77 159,113" />
            <polyline points="89,192 128,192 157,222" />
            <polyline points="89,315 125,315 157,318" />
            <polyline points="271,77 239,77 204,113" />
            <polyline points="271,192 234,192 207,222" />
            <polyline points="271,315 239,315 204,318" />
          </svg>
          <svg className="rp-hub-anchors" viewBox="0 0 360 400" preserveAspectRatio="none"
            focusable="false" aria-hidden="true">
            {[[159,113],[157,222],[157,318],[204,113],[207,222],[204,318]].map(([cx,cy],index) =>
              <circle key={index} cx={cx} cy={cy} r="3.2" />)}
          </svg>
          <div className="rp-hub-callouts rp-hub-callouts-left" aria-label="Leistung links">
            <div className="rp-hub-callout"><Gauge aria-hidden="true" /><span>TOP-SPEED</span><strong>{speedLabel}</strong></div>
            <div className="rp-hub-callout"><Footprints aria-hidden="true" /><span>SCHRITTLÄNGE</span><strong>{strideLabel}</strong></div>
            <div className="rp-hub-callout"><Trophy aria-hidden="true" /><span>BESTZEIT 50 M</span><strong>{best50}</strong></div>
          </div>
          <div className="rp-hologram-wrap rp-hub-runner rp-art-mode rp-hub-runner-static">
            <div className="rp-hub-ring" aria-hidden="true" />
            <div className="rp-holo-stage rp-holo-stage-static">
              <div className="rp-holo-center rp-holo-center-static">
                <img
                  className="rp-runner-reference-art rp-runner-reference-art-static"
                  src="/assets/runnit-reference-runner.webp"
                  alt="Originaler RUNNIT-Runner mit braunen Haaren, blauer Sportbrille, dunklem Shirt, Shorts und Laufschuhen"
                  draggable={false}
                />
              </div>
              <div className="rp-scan-line" aria-hidden="true" />
            </div>
            <div className="rp-plinth" aria-hidden="true" />
          </div>
          <div className="rp-hub-callouts rp-hub-callouts-right" aria-label="Leistung rechts">
            <div className="rp-hub-callout"><Zap aria-hidden="true" /><span>TOP-BESCHL.</span><strong>{accelerationLabel}</strong></div>
            <div className="rp-hub-callout"><Activity aria-hidden="true" /><span>SCHRITTFREQ.</span><strong>{cadenceLabel}</strong></div>
            <div className="rp-hub-callout"><Target aria-hidden="true" /><span>DUELLE</span><strong>{completedDuels}</strong></div>
          </div>
          {(performanceError || history.error) && <p className="rp-hub-measurement-error" role="status">Einige Messwerte sind gerade nicht verfügbar.</p>}
          <small className="rp-hub-beta">GEMESSENE WERTE · BETA</small>
        </section>


        <nav className="rp-hub-tabs" role="tablist" aria-label="Profilbereiche">
          {hubSections.map(({ id, label, Icon }, index) => (
            <button id={'rp-hub-tab-' + id} key={id} role="tab" type="button"
              aria-controls="rp-hub-panel" aria-selected={activeSection === id}
              tabIndex={activeSection === id ? 0 : -1}
              className={activeSection === id ? 'is-active' : ''}
              onClick={() => setActiveSection(id)}
              onKeyDown={(event) => {
                const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
                const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? hubSections.length - 1 :
                  direction ? (index + direction + hubSections.length) % hubSections.length : -1;
                if (nextIndex >= 0) {
                  event.preventDefault();
                  const next = hubSections[nextIndex].id;
                  setActiveSection(next);
                  document.getElementById('rp-hub-tab-' + next)?.focus();
                }
              }}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>

        <section id="rp-hub-panel" className="rp-hub-detail" role="tabpanel"
          tabIndex={0} aria-labelledby={'rp-hub-tab-' + activeSection}>
          {activeSection === 'identity' && (!user ? (
            <div className="rp-hub-guest">
              <div className="rp-hub-detail-head"><h2>RUNNER-ID</h2><span>GASTMODUS</span></div>
              <p>Deine Runner-ID, Bio und Kontodaten erscheinen hier nach der Anmeldung.</p>
              <Link to="/login?next=%2Fprofile" className="rp-hub-guest-login">
                <UserRound size={15} /> ANMELDEN / REGISTRIEREN
              </Link>
            </div>
          ) : <>
            <div className="rp-hub-detail-head">
              <h2>RUNNER-ID</h2>
              <button type="button" onClick={() => open('account')}><Settings size={15} /> KONTO</button>
            </div>
            <div className="rp-hub-id-strip">
              <span>{'R-' + user.id.slice(0, 8).toUpperCase()}</span>
              <button type="button" onClick={() => { void copyRunnerId(); }}
                aria-label="Vollständige Runner-ID kopieren"><Copy size={14} /> KOPIEREN</button>
            </div>
            <div className="rp-hub-detail-copy rp-hub-bio-display">
              <div><strong>RUNNER-BIO</strong><p>{profileLoading ? 'Lädt …' : profile.bio || 'Noch keine Bio hinterlegt.'}</p></div>
              <button type="button" onClick={() => open('bio')} aria-label="Runner-Bio bearbeiten"><Pencil size={16} /></button>
            </div>
            <button type="button" className="rp-hub-text-action" onClick={() => open('privacy')}><ShieldCheck size={15} /> RANGLISTEN-DATENSCHUTZ</button>
          </>)}
          {activeSection === 'style' && <>
            <div className="rp-hub-detail-head"><h2>RUNNER STYLE</h2><span>DEIN LOOK</span></div>
            <div className="rp-hub-style-layout">
              <div className="rp-hub-style-avatars" aria-label="Vorhandene Profilbilder">
                {(['original', 'arcade', 'classic'] as Avatar[]).map(item =>
                  <button key={item} type="button" onClick={() => open('editor')}
                    aria-label={'Profilbild ' + avatarNames[item] + ' im Editor auswählen'}
                    className={profile.avatar === item ? 'is-current' : ''}>
                    <img src={avatarImages[item]} alt="" /><span>{avatarNames[item]}</span>
                  </button>)}
              </div>
              <div className="rp-hub-style-details">
                <span>AKTUELLES OUTFIT</span><strong>RUNNIT ORIGINAL</strong>
                <button type="button" onClick={() => open('equipment')}><Footprints size={15} /> AUSRÜSTUNG</button>
                <small>SCHUHE: {profile.shoeType || 'Keine Angabe'}</small>
              </div>
            </div>
            <p className="rp-hub-mininote">Das Original-Outfit ist aktuell fest. Profilbilder und Schuhdaten kannst du bearbeiten.</p>
          </>}
          {activeSection === 'dna' && <>
            <div className="rp-hub-detail-head"><h2>RUNNER-DNA</h2><button type="button" onClick={() => open('dna')}><Pencil size={15} /> BEARBEITEN</button></div>
            <div className="rp-hub-data-grid">
              <span>GEBURTSJAHR <strong>{profile.birthYear || '—'}</strong></span>
              <span>GESCHLECHT <strong>{profile.gender || '—'}</strong></span>
              <span>GRÖSSE <strong>{profile.heightCm ? profile.heightCm + ' cm' : '—'}</strong></span>
              <span>GEWICHT <strong>{profile.weightKg ? profile.weightKg + ' kg' : '—'}</strong></span>
              <span>BMI <strong>{bmi === null ? '—' : bmi.toFixed(1).replace('.', ',')}</strong></span>
            </div>
            <p className="rp-hub-mininote">Freiwillige Körperdaten · BMI rechnerisch, kein Körperscan.</p>
          </>}
          {activeSection === 'training' && <>
            <div className="rp-hub-detail-head"><h2>TRAINING & ZIELE</h2><button type="button" onClick={() => open('training')}><Dumbbell size={15} /> TRAINING</button></div>
            <div className="rp-hub-detail-inline"><span>LAUFSTIL</span><strong>{profile.runningStyle || 'Keine Angabe'}</strong></div>
            <div className="rp-hub-detail-copy">
              <label><input type="checkbox" checked={profile.focusDone} disabled={isGuest || !profile.focus || saving}
                aria-label="Persönliches Ziel als erledigt markieren" onChange={() => { void toggleGoal(); }} />
                <span>{profile.focus || 'Noch kein Ziel gesetzt'}</span></label>
              <button type="button" onClick={() => open('goals')} aria-label="Ziel bearbeiten"><Pencil size={16} /></button>
            </div>
            <div className="rp-hub-detail-actions">
              <Link to="/calibration"><Footprints size={16} /> SCHRITTLÄNGE KALIBRIEREN</Link>
              <button type="button" onClick={() => open('training')}><Gauge size={16} /> LABORE & TESTS</button>
            </div>
          </>}
          {activeSection === 'badges' && <>
            <div className="rp-hub-detail-head"><h2>BADGES</h2><span>ECHTE AUSZEICHNUNGEN</span></div>
            <div className="rp-hub-badges-empty"><Trophy aria-hidden="true" />
              <div><strong>DEIN TROPHÄENREGAL</strong>
                <p>Noch keine vergebenen Badges. Hier erscheinen nur tatsächlich freigeschaltete Auszeichnungen.</p></div>
            </div>
          </>}
          {!user && activeSection !== 'identity' && <Link className="rp-login-inline rp-hub-login" to="/login?next=%2Fprofile">ANMELDEN, UM DEIN PROFIL ZU SPEICHERN</Link>}
        </section>
      </div>
      {notice && <div className="rp-notice" role="status">{notice}</div>}
      <BottomNav />

      {pane && <div className="rp-modal-backdrop" role="presentation"
        onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setPane(null); }}>
        <section className="rp-modal" role="dialog" aria-modal="true" aria-labelledby="rp-modal-title">
          <div className="rp-modal-heading"><h2 id="rp-modal-title">{labelForPane[pane]}</h2>
            <button type="button" className="rp-modal-secondary" aria-label="Dialog schließen" onClick={() => setPane(null)}>✕</button>
          </div>
          {pane === 'account' && (user ?
            <><AccountDetailsPanel user={user} updateDisplayName={updateDisplayName}
              changePassword={changePassword} signOut={signOut} />
              <button type="button" className="rp-modal-save rp-account-privacy" onClick={() => open('privacy')}>
                <ShieldCheck size={17} /> RANGLISTEN-DATENSCHUTZ
              </button></> :
            <Link to="/login?next=%2Fprofile" className="rp-modal-save">ANMELDEN / REGISTRIEREN</Link>)}
          {pane === 'privacy' && <div className="rp-modal-form">
            <p className="rp-mini-note">Körperdaten, Profil-Bio und persönliche Einstellungen bleiben in deinem Konto. Nur freigegebene Ranglistenleistungen können öffentlich angezeigt werden.</p>
            {user ? <label className="rp-privacy-switch">
              <span>Ergebnisse in Ranglisten veröffentlichen</span>
              <input type="checkbox" checked={optedIn} disabled={consentLoading || consentSaving}
                onChange={(event) => { void saveConsent(event.currentTarget.checked); }} />
            </label> : <Link to="/login?next=%2Fprofile" className="rp-modal-save">ZUM LOGIN</Link>}
            {consentError && <p role="alert" className="rp-modal-error">{consentError}</p>}
            <LegalLinks />
          </div>}
          {pane === 'badges' && <div className="rp-modal-form">
            <Trophy size={34} color="#88dbe5" /><p>Noch keine vergebenen Badges. Hier erscheinen nur wirklich freigeschaltete Auszeichnungen.</p>
          </div>}
          {pane !== 'account' && pane !== 'privacy' && pane !== 'badges' && (user ?
            <form className="rp-modal-form" onSubmit={(event) => { void submitProfile(event); }}>
              {pane === 'editor' && <>
                <p className="rp-mini-note">Wähle dein RUNNIT-Profilbild. Die Auswahl wird mit deinem Konto synchronisiert.</p>
                <div className="rp-avatar-grid">
                  {(['original', 'arcade', 'classic'] as Avatar[]).map(item => (
                    <button type="button" key={item} aria-pressed={draft.avatar === item}
                      onClick={() => setDraft({ ...draft, avatar: item })}>
                      <img src={avatarImages[item]} alt="" />{avatarNames[item]}
                    </button>
                  ))}
                </div>
              </>}
              {pane === 'dna' && <>
                <label>Geburtsjahr
                  <input type="number" inputMode="numeric" min="1900" max={new Date().getFullYear()}
                    value={draft.birthYear} onChange={event => setDraft({ ...draft, birthYear: event.currentTarget.value })} placeholder="Optional" />
                </label>
                <label>Geschlecht (freiwillig)
                  <select value={draft.gender} onChange={event => setDraft({ ...draft, gender: event.currentTarget.value })}>
                    <option value="">Keine Angabe</option><option>Männlich</option><option>Weiblich</option><option>Divers</option>
                  </select>
                </label>
                <label>Körpergröße (cm)
                  <input inputMode="decimal" type="number" min="80" max="250" step="0.1" placeholder="z. B. 173"
                    value={draft.heightCm} onChange={event => setDraft({ ...draft, heightCm: event.currentTarget.value })} />
                </label>
                <label>Gewicht (kg)
                  <input inputMode="decimal" type="number" min="20" max="300" step=".1" placeholder="z. B. 80"
                    value={draft.weightKg} onChange={event => setDraft({ ...draft, weightKg: event.currentTarget.value })} />
                </label>
                <p className="rp-mini-note">BMI: {bmiFor(draft) === null ? '—' : bmiFor(draft)!.toFixed(1).replace('.', ',')} · aus deinen Eingaben berechnet, keine Körperanalyse. Der Körperscan ist eine Animation und keine echte Messung.</p>
              </>}
              {pane === 'equipment' && <label>Dein Laufschuh-Typ
                <select value={draft.shoeType} onChange={event => setDraft({ ...draft, shoeType: event.currentTarget.value })}>
                  <option value="">Keine Angabe</option><option value="Straße">Straße</option>
                  <option value="Trail">Trail</option><option value="Allround">Allround</option>
                  <option value="Spikes">Spikes</option>
                </select>
              </label>}
              {pane === 'training' && <>
                <label>Bevorzugter Laufstil
                  <select value={draft.runningStyle} onChange={event => setDraft({ ...draft, runningStyle: event.currentTarget.value })}>
                    <option value="">Keine Angabe</option><option value="Sprint">Sprint</option>
                    <option value="Mittelstrecke">Mittelstrecke</option>
                    <option value="Langstrecke">Langstrecke</option>
                    <option value="Allround">Allround</option>
                  </select>
                </label>
                <p className="rp-mini-note">Kalibrierte Gehschrittlänge: {user.walkingCalibration ?
                  (user.walkingCalibration.walkingStrideM * 100).toFixed(1).replace('.', ',') + ' cm' :
                  'noch keine Messung'} · experimentell, keine Wettkampfwertung.</p>
                <Link to="/calibration" className="rp-modal-secondary">SCHRITTLÄNGE KALIBRIEREN</Link>
                <p className="rp-mini-note">ENTWICKLUNGSLABORE · nur Diagnostik und Simulation, keine Wettkampfergebnisse</p>
                <Link to="/gps-lab" className="rp-modal-secondary">SCHRITTZÄHLER TEST</Link>
                <Link to="/fusion-lab" className="rp-modal-secondary">GPS × IMU FUSION · DEMO</Link>
                <Link to="/sprint-lab" className="rp-modal-secondary">SPRINT-SIMULATION · DEMO</Link>
              </>}
              {pane === 'goals' && <>
                <label>Dein persönliches Ziel
                  <input type="text" maxLength={100} value={draft.focus} placeholder="z. B. Technik verbessern"
                    onChange={event => setDraft({ ...draft, focus: event.currentTarget.value, focusDone: false })} />
                </label>
                <label className="rp-goal-check"><input type="checkbox" checked={draft.focusDone}
                  onChange={event => setDraft({ ...draft, focusDone: event.currentTarget.checked })} /> Ziel erreicht</label>
              </>}
              {pane === 'bio' && <label>Deine Runner-Bio (max. 180 Zeichen)
                <textarea maxLength={180} value={draft.bio} onChange={event => setDraft({ ...draft, bio: event.currentTarget.value })} placeholder="Wer bist du? Was motiviert dich?" />
              </label>}
              {error && <p role="alert" className="rp-modal-error">{error}</p>}
              <button className="rp-modal-save" type="submit" disabled={saving}>{saving ? 'SPEICHERT …' : 'IN SUPABASE SPEICHERN'}</button>
              <button className="rp-modal-secondary" type="button" onClick={() => setPane('privacy')}><ShieldCheck size={15}/> PRIVATSPHÄRE</button>
            </form> : <div className="rp-modal-form"><p>Als Gast kannst du das Profil ansehen. Zum Speichern melde dich an.</p>
              <Link to="/login?next=%2Fprofile" className="rp-modal-save">ANMELDEN / REGISTRIEREN</Link>
            </div>)}
        </section>
      </div>}
    </main>
  );
}
