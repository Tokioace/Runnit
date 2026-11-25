import { useEffect, useRef, useState, type FormEvent } from 'react';
import { readAccountDeletionRequest, requestAccountDeletion } from '../../db/accountDeletionRequest';
import { isDeletionConfirmation, type DeletionRequest } from '../../lib/accountDeletionRequest';

export default function AccountDeletionPanel({ userId }: { userId: string }) {
  const [request, setRequest] = useState<DeletionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const pendingRef = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadFailed(false);
    void readAccountDeletionRequest(userId).then(value => {
      if (active) setRequest(value);
    }).catch(() => { if (active) setLoadFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, revision]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingRef.current || !isDeletionConfirmation(confirmation)) return;
    pendingRef.current = true;
    setBusy(true); setError(false);
    try {
      const value = await requestAccountDeletion(userId, confirmation);
      setRequest(value); setOpen(false); setConfirmation('');
    } catch { setError(true); }
    finally { pendingRef.current = false; setBusy(false); }
  };
  return <div className="mt-5 border-t border-white/10 pt-5">
    <h3 className="text-sm font-bold text-white">Konto löschen</h3>
    {loading ? <p role="status" className="mt-2 text-xs text-white/60">Löschstatus wird geladen …</p> :
      loadFailed ? <div className="mt-2 space-y-2">
        <p role="alert" className="text-xs text-rose-200">Löschstatus konnte nicht geladen werden.</p>
        <button type="button" onClick={() => setRevision(n => n+1)} className="min-h-12 w-full rounded-xl border border-white/15 text-sm font-bold">Erneut versuchen</button>
      </div> :
      request ? <p role="status" className="mt-2 text-xs leading-5 text-amber-100">
        Löschanfrage erhalten am {new Date(request.requested_at).toLocaleDateString('de-DE')}. Dein Konto ist noch nicht gelöscht. Du erhältst nach Abschluss eine Bestätigung per E-Mail.
      </p> :
      open ? <form onSubmit={event => { void submit(event); }} className="mt-3 space-y-3">
        <p className="text-xs leading-5 text-white/75">Beantrage die dauerhafte Löschung deines Kontos und der zugehörigen personenbezogenen Daten, soweit keine gesetzliche Aufbewahrungspflicht besteht. Die Bearbeitung erfolgt manuell; das Konto wird nicht sofort gelöscht.</p>
        <label htmlFor="confirm-account-deletion" className="block text-xs font-semibold">Zur Bestätigung LÖSCHEN eingeben</label>
        <input id="confirm-account-deletion" value={confirmation} onChange={event => setConfirmation(event.target.value)}
          autoComplete="off" disabled={busy} className="min-h-12 w-full rounded-xl border border-rose-300/25 bg-[#101322] px-4 text-base" />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => { setOpen(false); setConfirmation(''); setError(false); }} className="min-h-12 rounded-xl border border-white/15 text-sm font-bold">Abbrechen</button>
          <button type="submit" disabled={busy || !isDeletionConfirmation(confirmation)} className="min-h-12 rounded-xl border border-rose-300/30 bg-rose-500/20 text-sm font-bold text-rose-100 disabled:opacity-50">{busy ? 'Senden …' : 'Löschung beantragen'}</button>
        </div>
        {error && <p role="alert" className="text-xs text-rose-200">Anfrage nicht bestätigt. Bitte erneut versuchen.</p>}
      </form> :
      <button type="button" onClick={() => setOpen(true)} className="mt-3 min-h-12 w-full rounded-xl border border-rose-300/25 bg-rose-500/10 text-sm font-bold text-rose-200">Konto dauerhaft löschen</button>}
  </div>;
}
