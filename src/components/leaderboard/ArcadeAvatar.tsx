/** Original, deterministic vector portraits for the explicitly fictional
 * leaderboard DESIGN PREVIEW. No fetched identities, profile photos, or
 * claims about real users. Each is a tiny blue-visor Y2K arcade runner. */
export type ArcadeAvatarVariant = 'speed' | 'night' | 'aero' | 'player' | 'hikari';

const designs: Record<ArcadeAvatarVariant, {
  sky: string; shadow: string; glow: string; hair: string; skin: string; suit: string;
}> = {
  speed:  { sky: '#134ce9', shadow: '#080f4e', glow: '#16eaff', hair: '#102451', skin: '#d39056', suit: '#2444ac' },
  night:  { sky: '#215db2', shadow: '#071b32', glow: '#33def4', hair: '#2e1a20', skin: '#c17c50', suit: '#174c8e' },
  aero:   { sky: '#38b9f9', shadow: '#091854', glow: '#31f0ff', hair: '#0a348b', skin: '#3f81b9', suit: '#1155bf' },
  player: { sky: '#0583d7', shadow: '#051638', glow: '#98ff2d', hair: '#44241d', skin: '#e3a86d', suit: '#0860bc' },
  hikari: { sky: '#1eb9f2', shadow: '#132077', glow: '#8a7dfb', hair: '#0c215e', skin: '#237fc0', suit: '#192c7d' },
};

export default function ArcadeAvatar({ variant }: { variant: ArcadeAvatarVariant }) {
  const v = designs[variant];
  const bg = 'runnit-avatar-bg-' + variant;
  const light = 'runnit-avatar-light-' + variant;
  const lens = 'runnit-avatar-lens-' + variant;
  const masked = variant === 'hikari' || variant === 'aero';
  return (
    <svg className="runnit-board-avatar-art" viewBox="0 0 88 88" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={v.sky} />
          <stop offset=".6" stopColor={v.shadow} />
          <stop offset="1" stopColor="#030b30" />
        </linearGradient>
        <radialGradient id={light} cx=".7" cy=".25" r=".75">
          <stop stopColor={v.glow} stopOpacity=".9" />
          <stop offset="1" stopColor={v.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={lens} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#dbffff" />
          <stop offset=".24" stopColor="#19e7ff" />
          <stop offset=".6" stopColor="#1267ef" />
          <stop offset="1" stopColor="#052073" />
        </linearGradient>
      </defs>
      <rect width="88" height="88" rx="8" fill={`url(#${bg})`} />
      <rect width="88" height="88" fill={`url(#${light})`} opacity=".45" />
      <path d="M-8 31 31-4 47-4 6 45ZM44 89 89 47 94 62 67 92Z" fill="#7df7ff" opacity=".24" />
      <path d="M-2 88Q14 70 30 68L51 67Q74 69 94 88Z" fill="#030c35" />
      <path d="M4 88Q20 66 38 67L55 65Q75 72 88 88Z" fill={v.suit} stroke="#44bdfb" strokeWidth="2" />
      <path d="M35 68 40 57 53 57 57 70 49 78Z" fill="#163458" />
      <path d="M24 33Q28 13 47 13Q65 14 68 36L65 55Q60 67 46 70Q29 65 25 54Z"
        fill={masked ? v.skin : '#362d38'} stroke="#081838" strokeWidth="3" />
      {!masked && <path d="M27 33Q37 23 52 26Q65 29 64 44L62 52 49 61 36 56 28 49Z"
        fill={v.skin} stroke="#734b45" strokeWidth="1" />}
      {masked && <path d="M28 31Q44 20 62 30L65 51Q59 62 46 66L30 57Z" fill={variant === 'hikari' ? '#075ca8' : '#115cb2'} />}
      {variant === 'speed' && <>
        <path d="M21 37 12 28 24 29 26 17 34 22 42 7 46 19 59 8 58 23 71 19 66 37Z" fill={v.hair} stroke="#4cb6fa" strokeWidth="2" />
        <path d="M19 38 26 26 41 23 64 27 69 36 57 33 41 31Z" fill="#243e78" />
      </>}
      {variant === 'night' && <>
        <path d="M20 36 18 25 31 18 39 8 47 19 57 11 66 25 69 35 53 29 34 32Z" fill={v.hair} stroke="#ff914d" strokeWidth="1.4" />
        <path d="M26 20 39 11 43 18 51 12" fill="none" stroke="#dc8e48" strokeWidth="3" />
      </>}
      {variant === 'player' && <>
        <path d="M21 36 17 23 28 26 26 12 38 21 47 9 54 23 66 14 65 30 73 33 65 42 51 29 35 32Z"
          fill={v.hair} stroke="#ffac57" strokeWidth="2" />
        <path d="M28 21 34 17 38 23M48 14 54 26" stroke="#b87a39" strokeWidth="3" fill="none" />
      </>}
      {variant === 'aero' && <>
        <path d="M17 35Q20 9 46 8Q71 9 73 36L63 29 54 21 29 27Z" fill="#0a298c" stroke="#3fe9ff" strokeWidth="2.5" />
        <path d="M23 30 40 12 64 19" stroke="#6bcfff" strokeWidth="2" fill="none" />
      </>}
      {variant === 'hikari' && <>
        <path d="M16 41Q18 13 44 10Q73 13 76 39L66 54 61 37 52 22 30 30 22 53Z"
          fill="#051c57" stroke="#59eaff" strokeWidth="3" />
        <path d="M19 27 32 13 48 11 60 18" fill="none" stroke="#a1f6ff" strokeWidth="3" />
      </>}
      <path d="M22 39Q36 34 65 37L70 44Q60 54 47 52L32 49 23 47Z"
        fill="#081b47" stroke="#0b285d" strokeWidth="3.4" />
      <path d="M25 40Q42 35 65 40L63 47Q45 53 26 46Z"
        fill={`url(#${lens})`} stroke="#88f6ff" strokeWidth="1.3" />
      <path d="M28 41Q43 39 58 41" fill="none" stroke="#eaffff" strokeWidth="2" opacity=".8" />
      {!masked && <path d="M57 55 66 51 60 60 51 63" fill="#f0bf80" opacity=".8" />}
      <path d="M5 78 23 67 33 78M62 72 78 80" fill="none" stroke="#67e4ff" strokeWidth="3" opacity=".75" />
      <path d="M4 4h18M4 4v18M84 66v18H65" fill="none" stroke="#9bf7ff" strokeWidth="2" opacity=".58" />
    </svg>
  );
}
