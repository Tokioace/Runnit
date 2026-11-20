import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Dna,
  Dumbbell, Footprints, Gauge, Image as Picture, LockKeyhole, Mars,
  Pencil, Play, Pause, RotateCw, Ruler, Settings, ShieldCheck, Shirt,
  Target, Trophy, UserRound, Weight, Zap,
} from 'lucide-react';
import BottomNav from '../components/ui/BottomNav';
import RunnerHologramModel from '../components/profile/RunnerHologramModel';
import AccountDetailsPanel from '../components/profile/AccountDetailsPanel';
import { useSupabaseUser } from '../hooks/useSupabaseUser';
import { supabase } from '../lib/supabaseClient';
import '../styles/profileY2k.css';

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
const menu = [
  { id: 'bio', title: 'PROFIL', Icon: UserRound },
  { id: 'editor', title: 'RUNNER EDITOR', Icon: Shirt },
  { id: 'dna', title: 'RUNNER-DNA', Icon: Dna },
  { id: 'equipment', title: 'AUSRÜSTUNG', Icon: Footprints },
  { id: 'training', title: 'TRAINING', Icon: Dumbbell },
  { id: 'goals', title: 'ZIELE', Icon: Target },
  { id: 'badges', title: 'BADGES', Icon: Trophy },
] as const;

export default function ProfileScreen() {
  const { user, loading, signOut, updateDisplayName, changePassword } = useSupabaseUser();
  const [profile, setProfile] = useState<RunnerProfile>({ ...EMPTY_PROFILE });
  const [draft, setDraft] = useState<RunnerProfile>({ ...EMPTY_PROFILE });
  const [profileLoading, setProfileLoading] = useState(false);
  const [performance, setPerformance] = useState<Performance>(EMPTY_PERFORMANCE);
  const [performanceError, setPerformanceError] = useState(false);
  const [pane, setPane] = useState<Pane>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [optedIn, setOptedIn] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [turnAngle, setTurnAngle] = useState(0);
  const [turning, setTurning] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setProfile({ ...EMPTY_PROFILE });
      setDraft({ ...EMPTY_PROFILE });
      setPerformance(EMPTY_PERFORMANCE);
      setOptedIn(false);
      return;
    }
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
      const { data: identity, error: authError } = await supabase.auth.getUser();
      if (authError || identity.user?.id !== user.id) throw new Error('session');
      const { data, error: saveError } = await supabase.auth.updateUser({
        data: { runnit_profile_v1: next },
      });
      if (saveError || data.user?.id !== user.id) throw saveError || new Error('profile');
      setProfile(next); setDraft(next); setNotice('Profil gespeichert.');
      return true;
    } catch {
      setError('Speichern fehlgeschlagen. Bitte prüfe deine Anmeldung.');
      return false;
    } finally { setSaving(false); }
  }, [user?.id, saving]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await saveProfile(draft)) setPane(null);
  }
  async function saveConsent(next: boolean) {
    if (!user?.id || consentSaving || consentLoading) return;
    setConsentSaving(true); setConsentError('');
    try {
      const { data, error: updateError } = await supabase.from('users')
        .update({ leaderboard_opt_in: next }).eq('id', user.id)
        .select('leaderboard_opt_in').single();
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
  return (
    <main className="rp-screen">
      <div className="rp-background" aria-hidden="true" />
      <div className="rp-stage">
        <section className="rp-headzone" aria-label="RUNNIT Profil">
          <header className="rp-topbar">
            <Link to="/home" className="rp-square" aria-label="Zurück zu Home"><ArrowLeft aria-hidden="true" /></Link>
            <img className="rp-title-mark" src="/runnit-metal-logo.svg" alt="RUNNIT" />
            <span className="rp-profile-word">PROFIL</span>
            <button type="button" className="rp-square" onClick={() => open('account')} aria-label="Kontoeinstellungen öffnen">
              <Settings aria-hidden="true" />
            </button>
          </header>
          <div className="rp-identity">
            <div className="rp-portrait"><img src={avatar} alt="Dein gewähltes Runner-Profilbild" /></div>
            <div className="rp-player-text">
              <strong className="rp-player-name">{name}</strong>
              <span className="rp-player-sub">{user ? 'ANGEMELDETER RUNNER' : 'GASTMODUS'}</span>
              <div className="rp-player-tags"><span>LVL <b>—</b></span><span>R <b>—</b></span></div>
            </div>
            <button type="button" className="rp-identity-edit" onClick={() => open('editor')} aria-label="Profilbild bearbeiten"><Pencil size={14} /></button>
          </div>
        </section>

        <section className="rp-dashboard" aria-label="Runner-Editor und Körperdaten">
          <nav className="rp-side" aria-label="Profilbereiche">
            {menu.map(({ id, title, Icon }) => (
              <button key={id} type="button" className={id === 'bio' ? 'is-selected' : ''} onClick={() => open(id)}>
                <Icon aria-hidden="true" /> <span>{title}</span>
              </button>
            ))}
          </nav>
          <div className="rp-hologram-wrap">
            <div className="rp-holo-label">360° SCAN</div>
            <div className="rp-holo-stage">
              <div className="rp-holo-center">
                <RunnerHologramModel rotating={turning} manualAngle={turnAngle} />
              </div>
              <button type="button" className="rp-holo-pause" aria-label={turning ? 'Rotation anhalten' : 'Rotation fortsetzen'}
                aria-pressed={turning} onClick={() => setTurning(value => !value)}>
                {turning ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <div className="rp-scan-line" aria-hidden="true" />
            </div>
            <div className="rp-plinth" aria-hidden="true" />
            <div className="rp-holo-controls">
              <button type="button" aria-label="Runner links drehen" onClick={() => { setTurning(false); setTurnAngle(angle => angle - 45); }}><ChevronLeft /></button>
              <button type="button" aria-label="Runner rechts drehen" onClick={() => { setTurning(false); setTurnAngle(angle => angle + 45); }}><ChevronRight /></button>
            </div>
          </div>
          <section className="rp-info" aria-label="Private Runner-Daten">
            <h2>RUNNER-ID</h2>
            {[
              { Icon: UserRound, label: 'Name', value: name, pane: 'account' as const },
              { Icon: CalendarDays, label: 'Geburtsjahr', value: profile.birthYear || '—', pane: 'dna' as const },
              { Icon: Mars, label: 'Geschlecht', value: profile.gender || '—', pane: 'dna' as const },
              { Icon: Ruler, label: 'Größe', value: profile.heightCm ? profile.heightCm + ' cm' : '—', pane: 'dna' as const },
              { Icon: Weight, label: 'Gewicht', value: profile.weightKg ? profile.weightKg + ' kg' : '—', pane: 'dna' as const },
            ].map(({ Icon, label, value, pane: toPane }) => (
              <div className="rp-info-row" key={label}>
                <Icon aria-hidden="true" /><span className="rp-field-title">{label}</span>
                <strong>{value}</strong>
                <button type="button" aria-label={label + ' bearbeiten'} onClick={() => open(toPane)}><Pencil /></button>
              </div>
            ))}
            <div className="rp-info-row">
              <Activity aria-hidden="true" /><span className="rp-field-title">BMI</span>
              <div><strong>{bmi === null ? '—' : bmi.toFixed(1).replace('.', ',')}</strong>{bmi !== null && <div className="rp-bmi-gradient" aria-hidden="true" />}</div>
            </div>
          </section>
        </section>

        <section className="rp-records" aria-label="Gemessene Runner-Leistungsdaten">
          <h2>LEISTUNGSPROFIL <span title="Beta-Messwerte. Noch nicht unabhängig auf Manipulation geprüft.">BETA</span></h2>
          <div className="rp-record-tiles">
            {[
              { Icon: Zap, label: 'TOP-BESCHL.', value: formatMetric(performance.acceleration, 'm/s²', 2) },
              { Icon: Gauge, label: 'TOP-SPEED', value: formatMetric(performance.speed === null ? null : performance.speed * 3.6, 'km/h') },
              { Icon: Footprints, label: 'SCHRITTLÄNGE', value: formatMetric(performance.stride, 'm', 2) },
              { Icon: Activity, label: 'SCHRITTFREQ.', value: formatMetric(performance.cadence, 'spm', 0) },
            ].map(({ Icon, label, value }) => <div className="rp-record" key={label}>
              <Icon aria-hidden="true" /><small>{label}</small><strong>{value}</strong>
            </div>)}
          </div>
          {performanceError && <p className="rp-perf-error" role="alert">Messwerte konnten nicht geladen werden.</p>}
        </section>

        <section className="rp-bio-row" aria-label="Persönliches Runner-Profil">
          <div className="rp-widget">
            <h2>RUNNER-BIO <button type="button" onClick={() => open('bio')} aria-label="Runner-Bio bearbeiten"><Pencil /></button></h2>
            <p className={!profile.bio ? 'rp-widget-empty' : ''}>{profileLoading ? 'Lädt …' : profile.bio || 'Noch keine Bio. Hier kannst du dich vorstellen.'}</p>
          </div>
          <div className="rp-widget">
            <h2>ZIELE & FOKUS <button type="button" onClick={() => open('goals')} aria-label="Ziel bearbeiten"><Pencil /></button></h2>
            <label>
              <input type="checkbox" checked={profile.focusDone} disabled={isGuest || !profile.focus || saving}
                aria-label="Persönliches Ziel als erledigt markieren" onChange={() => { void toggleGoal(); }} />
              <span className={!profile.focus ? 'rp-widget-empty' : ''}>{profile.focus || 'Noch kein Ziel gesetzt'}</span>
            </label>
            {!user && <Link className="rp-login-inline" to="/login?next=%2Fprofile">ANMELDEN</Link>}
          </div>
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
