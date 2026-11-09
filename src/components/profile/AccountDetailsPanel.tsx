import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, LogOut, Mail, Pencil, Save, ShieldAlert, UserRound } from 'lucide-react';
import type { AuthUser, UseSupabaseUserReturn } from '../../hooks/useSupabaseUser';
import { getAccountDisplayNameError } from '../../lib/accountProfile';

type Props = {
  user: AuthUser;
  updateDisplayName: UseSupabaseUserReturn['updateDisplayName'];
  signOut: UseSupabaseUserReturn['signOut'];
};

export default function AccountDetailsPanel({ user, updateDisplayName, signOut }: Props) {
  const [draftName, setDraftName] = useState(user.displayName);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setDraftName(user.displayName);
  }, [editing, user.displayName]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const validation = getAccountDisplayNameError(draftName);
    if (validation) {
      setError(validation);
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await updateDisplayName(draftName);
      setEditing(false);
      setMessage('Dein Anzeigename wurde gespeichert.');
    } catch {
      setError('Speichern nicht möglich. Bitte versuche es erneut.');
    } finally {
      setPending(false);
    }
  };

  const logout = async () => {
    if (pending || !confirmLogout) return;
    setPending(true);
    setError(null);
    try {
      await signOut();
    } catch {
      setError('Abmelden fehlgeschlagen. Bitte versuche es erneut.');
      setPending(false);
    }
  };

  return (
    <section aria-label="Dein Runnit-Konto" className="overflow-hidden rounded-[28px] border border-violet-300/20 bg-gradient-to-br from-violet-500/20 via-[#171529] to-cyan-500/[0.075] p-5 shadow-[0_15px_50px_rgba(0,0,0,.18)]">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] border border-violet-300/30 bg-violet-400/15">
          <UserRound className="h-8 w-8 text-violet-200" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-300">ANGEMELDETES KONTO</p>
          <h2 className="mt-1 truncate text-2xl font-black tracking-tight">{user.displayName}</h2>
          <p className="mt-1 text-[11px] text-white/50">Anzeigename · nicht identitätsgeprüft</p>
        </div>
      </div>

      <div className="mt-6 space-y-3 border-t border-white/10 pt-5">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">E-Mail (nur in deinem Profil)</p>
            <p className="mt-1 break-all text-sm font-semibold text-white/90">{user.email || 'Keine E-Mail-Adresse verfügbar'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 text-xs leading-5">
          {user.emailConfirmed
            ? <><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" /><span className="text-emerald-200">E-Mail-Adresse bestätigt</span></>
            : <><ShieldAlert className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" /><span className="text-amber-200">E-Mail-Adresse noch nicht bestätigt</span></>}
        </div>
      </div>

      {editing ? (
        <form onSubmit={(event) => { void save(event); }} className="mt-5 space-y-3">
          <label htmlFor="edit-display-name" className="block text-xs font-semibold text-white/75">Neuer Anzeigename</label>
          <input id="edit-display-name" type="text" required minLength={3} maxLength={24} autoComplete="nickname"
            value={draftName} disabled={pending} onChange={event => setDraftName(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-white/20 bg-[#101322] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-violet-400" />
          <p className="text-[11px] leading-5 text-white/50">3–24 Zeichen. Der Name ist nicht eindeutig und keine verifizierte Identität.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={pending} onClick={() => { setEditing(false); setDraftName(user.displayName); setError(null); }}
              className="min-h-12 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-bold text-white/75">Abbrechen</button>
            <button type="submit" disabled={pending} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-3 text-sm font-bold">
              <Save className="h-4 w-4" aria-hidden="true" />{pending ? 'Speichern …' : 'Speichern'}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setEditing(true); setMessage(null); }} disabled={pending}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-violet-300/25 bg-violet-500/15 px-4 text-sm font-bold text-violet-100 transition hover:bg-violet-500/25">
          <Pencil className="h-4 w-4" aria-hidden="true" /> Anzeigenamen bearbeiten
        </button>
      )}

      {message && <p role="status" className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-xs text-emerald-200">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-xs text-rose-200">{error}</p>}
      {confirmLogout ? (
        <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4">
          <p className="text-xs leading-5 text-amber-100">Wirklich abmelden? Dadurch wird die gespeicherte Anmeldung beendet. Beim nächsten Besuch musst du dich erneut per E-Mail anmelden.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={pending} onClick={() => setConfirmLogout(false)}
              className="min-h-12 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-bold text-white">Angemeldet bleiben</button>
            <button type="button" disabled={pending} onClick={() => { void logout(); }}
              className="min-h-12 rounded-xl border border-amber-300/30 bg-amber-300/15 px-3 text-sm font-bold text-amber-100">
              {pending ? 'Abmelden …' : 'Wirklich abmelden'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={pending} onClick={() => setConfirmLogout(true)}
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 text-sm font-bold text-white/70 transition hover:bg-white/[0.08]">
          <LogOut className="h-4 w-4" aria-hidden="true" /> Abmelden
        </button>
      )}
    </section>
  );
}
