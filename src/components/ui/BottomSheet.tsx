import * as React from 'react';
import { X } from 'lucide-react';

export function BottomSheet({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center">
      <button
        type="button"
        aria-label="Dialog schließen"
        className="absolute inset-0 h-full w-full cursor-default bg-[#050611]/80 backdrop-blur-[6px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Runnit Dialog'}
        className="relative flex max-h-[84dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[30px] border-x border-t border-violet-200/15 bg-[#101322] text-white shadow-[0_-30px_100px_rgba(0,0,0,.5)]"
      >
        <div aria-hidden="true" className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-white/20" />
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 pb-4 pt-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-300">RUNNIT · BETA</p>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight">{title || 'Runnit'}</h2>
          </div>
          <button
            type="button"
            aria-label="Dialog schließen"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
          {children}
        </div>
      </section>
    </div>
  );
}
