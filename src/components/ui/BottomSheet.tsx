'use client';
import * as React from 'react';

export function BottomSheet({ 
  open, 
  onClose, 
  children, 
  title 
}: {
  open: boolean; 
  onClose: () => void; 
  children: React.ReactNode; 
  title?: string;
}) {
  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  if (!open) return null;

  return (
    <div aria-hidden={!open} className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      <div 
        className={`absolute inset-0 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose} 
      />
      <section 
        role="dialog" 
        aria-modal 
        className={`absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface shadow-deep transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {title && (
          <header className="sticky top-0 z-10 border-b border-white/5 bg-surface/90 backdrop-blur px-4 py-3 text-base font-semibold">
            {title}
          </header>
        )}
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {children}
        </div>
      </section>
    </div>
  );
}