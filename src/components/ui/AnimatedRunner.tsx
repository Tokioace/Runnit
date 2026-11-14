import type { CSSProperties } from 'react';

/**
 * Lightweight original vector runner for the fictional race preview.
 * Every body part is drawn as SVG: no platform-dependent runner emoji,
 * image requests, sensors, or dependency on actual athlete data.
 */
export default function AnimatedRunner({
  moving, rival = false, cycleMs = 370,
}: {
  moving: boolean;
  rival?: boolean;
  cycleMs?: number;
}) {
  const shirt = rival ? '#e879f9' : '#67e8f9';
  const shorts = rival ? '#a855f7' : '#2563eb';
  const shoes = rival ? '#f0abfc' : '#a5f3fc';
  return (
    <svg
      viewBox="0 0 48 48"
      width="38"
      height="38"
      aria-hidden="true"
      focusable="false"
      className={`runnit-sprint-runner ${moving ? 'runnit-sprint-runner--moving' : ''}`}
      style={{ '--runnit-run-cycle': `${cycleMs}ms` } as CSSProperties}
    >
      {/* A left-side ponytail / hair tuft and a visible right-side eye make
          the running direction unmistakably point toward the finish. */}
      <g className="runnit-sprint-arm--back" stroke="#c99a7c" strokeWidth="4.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M22 21 L14 23 L11 29" />
      </g>
      <g className="runnit-sprint-leg--back" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M20 30 L12 36 L10 41" stroke="#c99a7c" strokeWidth="5" />
        <path d="M10 41 L5 42" stroke={shoes} strokeWidth="4.5" />
      </g>
      <g className="runnit-sprint-body">
        <path d="M24 17 L28 21 L22 32 L15 28 L19 20 Z" fill={shirt} stroke="#17213d" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M22 28 L19 32 L15 30 L15 27 Z" fill={shorts} />
        <path d="M27.2 17.5 L29 19.5" stroke="#c99a7c" strokeWidth="3" strokeLinecap="round" />
        <circle cx="30.5" cy="11.5" r="6.1" fill="#e9bc96" stroke="#7a4b42" strokeWidth="0.8" />
        <path d="M24.5 10.5 Q25 4.9 31.5 5.4 Q34 5.4 35.4 8.4 L32 8.5 Q28 7.7 26.5 12 Z" fill="#1b1d36" />
        <path d="M25 11 L21 14" stroke="#1b1d36" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="34" cy="11.2" r="0.9" fill="#1b1d36" />
        <path d="M35.8 14.7 L33.7 15.2" stroke="#9b5d51" strokeWidth="0.8" strokeLinecap="round" />
      </g>
      <g className="runnit-sprint-leg--front" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M19 30 L29 34 L35 32" stroke="#e9bc96" strokeWidth="5.5" />
        <path d="M35 32 L40.5 33" stroke={shoes} strokeWidth="4.5" />
      </g>
      <g className="runnit-sprint-arm--front" stroke="#e9bc96" strokeWidth="4.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M23 21 L31 25 L36 20" />
      </g>
    </svg>
  );
}
