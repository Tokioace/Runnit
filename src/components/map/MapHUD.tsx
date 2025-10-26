import React from 'react';

export function MapHUD({ city }: { city: string }) {
  return (
    <div className="pointer-events-none fixed top-4 left-4 z-30 flex flex-col gap-2">
      <div className="pointer-events-auto rounded-xl bg-surface/80 backdrop-blur px-3 py-2 text-sm text-text shadow-soft">
        City: <span className="font-semibold">{city}</span>
      </div>
    </div>
  );
}