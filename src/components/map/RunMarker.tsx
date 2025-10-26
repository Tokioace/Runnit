import React from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

export function RunMarker({ 
  position, 
  active = false, 
  label 
}: { 
  position: [number, number]; 
  active?: boolean; 
  label: string 
}) {
  // Create a custom divIcon for round marker with glow
  const className = `relative grid place-items-center h-9 w-9 rounded-full border border-white/10 bg-surface2 ${
    active ? 'ring-4 ring-primary/25 animate-pulseGlow' : ''
  }`;
  
  const html = `<div class='${className}'>
    <div class="h-6 w-6 rounded-full bg-primary/90 border border-white/20"></div>
  </div>`;
  
  const icon = L.divIcon({ 
    className: '', 
    html, 
    iconSize: [36, 36], 
    iconAnchor: [18, 18] 
  });

  return (
    <Marker position={position} icon={icon}>
      <Tooltip direction="top" offset={[0, -8]}>
        {label}
      </Tooltip>
    </Marker>
  );
}