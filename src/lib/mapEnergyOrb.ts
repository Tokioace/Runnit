import type { Map as GLMap } from 'maplibre-gl';

/**
 * Y2K / PS2 street-challenge energy orbs.
 *
 * Seven deterministic 2x-resolution raster sprites, generated once per map
 * style from local canvas instructions. No external fonts, image downloads,
 * user data, continuous canvas painting, or per-player HTML elements.
 */
export type EnergyOrbTone = 'open-race' | 'own-race' | 'visible-runner' | 'running-match' | 'mixed';
export type OrbSeed = { kind: Exclude<EnergyOrbTone, 'mixed'>; count: number };
export type EnergyOrbSpec = { id: string; count: number; tone: EnergyOrbTone };

export const ENERGY_ORB_PREFIX = 'runnit-energy-orb';
export const ENERGY_ORB_PIXEL_RATIO = 2;
const ORB_CSS_SIZE = 100;

const COLORS: Record<EnergyOrbTone, {
  neon: string; shine: string; glow: string; veil: string; secondary: string;
}> = {
  'open-race': {
    neon: '#ff4be0', shine: '#ffe0ff', glow: 'rgba(255,39,201,.32)',
    veil: 'rgba(255,39,201,0)', secondary: '#ffb8f6',
  },
  'own-race': {
    // Own challenges remain chartreuse, as the original map distinguishes them.
    neon: '#c9ff0b', shine: '#f4ffe0', glow: 'rgba(174,255,35,.30)',
    veil: 'rgba(174,255,35,0)', secondary: '#56edff',
  },
  'visible-runner': {
    neon: '#a57aff', shine: '#f4e8ff', glow: 'rgba(151,83,255,.34)',
    veil: 'rgba(151,83,255,0)', secondary: '#47eaff',
  },
  'running-match': {
    neon: '#ffbc49', shine: '#fff2c0', glow: 'rgba(255,166,43,.30)',
    veil: 'rgba(255,166,43,0)', secondary: '#ffe78a',
  },
  mixed: {
    neon: '#57ebff', shine: '#f1fcff', glow: 'rgba(89,202,255,.27)',
    veil: 'rgba(89,202,255,0)', secondary: '#e19bff',
  },
};

export const energyOrbId = (tone: EnergyOrbTone, count: number) =>
  `${ENERGY_ORB_PREFIX}-${tone}-${count}`;

/**
 * Register every possible mixed city-cluster total in advance, because
 * MapLibre expression-based icon lookup needs a pre-existing sprite.
 * This is for the fixed, opt-in 3-city demo; it is NOT a live-player count.
 */
export function getEnergyOrbSpecs(seeds: readonly OrbSeed[]): EnergyOrbSpec[] {
  const specs = seeds.map(({ kind, count }) => ({
    tone: kind as EnergyOrbTone, count, id: energyOrbId(kind, count),
  }));
  for (let mask = 1; mask < 1 << seeds.length; mask++) {
    if ((mask & (mask - 1)) === 0) continue; // a single city stays type-colored
    let count = 0;
    for (let index = 0; index < seeds.length; index++) {
      if (mask & (1 << index)) count += seeds[index].count;
    }
    if (!specs.some(spec => spec.tone === 'mixed' && spec.count === count)) {
      specs.push({ id: energyOrbId('mixed', count), count, tone: 'mixed' });
    }
  }
  return specs;
}

function drawEnergyOrb(spec: EnergyOrbSpec): ImageData | undefined {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  const px = ORB_CSS_SIZE * ENERGY_ORB_PIXEL_RATIO;
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.scale(ENERGY_ORB_PIXEL_RATIO, ENERGY_ORB_PIXEL_RATIO);

  const { neon, shine, glow, veil, secondary } = COLORS[spec.tone];
  const cx = 50, cy = 50;
  const ringRadius = 30.5;
  const circle = (radius: number, color: string, width: number, blur = 0) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = neon;
    ctx.shadowBlur = blur;
    ctx.stroke();
    ctx.restore();
  };

  // Soft Y2K aura stays in the sprite and therefore follows cluster geography.
  const aura = ctx.createRadialGradient(cx, cy, 14, cx, cy, 49);
  aura.addColorStop(0, glow);
  aura.addColorStop(.58, glow);
  aura.addColorStop(1, veil);
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, ORB_CSS_SIZE, ORB_CSS_SIZE);

  // A subtle orbital stroke conveys motion without battery-hungry animation.
  // Cyan traces make runner/community nodes visually distinct from open races.
  if (spec.tone === 'visible-runner' || spec.tone === 'mixed') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 6);
    ctx.beginPath();
    ctx.ellipse(0, 0, 39, 19, 0, Math.PI * .20, Math.PI * 1.60);
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 1.45;
    ctx.shadowColor = secondary;
    ctx.shadowBlur = 7;
    ctx.stroke();
    ctx.restore();
  }

  circle(35.5, 'rgba(221,239,255,.30)', .7);
  circle(ringRadius + 1.7, neon, 3.6, 9);
  circle(ringRadius + 1.1, shine, .85, 1);

  // Glass core: legible dark ground, a cobalt reflection and a thin interior rim.
  const core = ctx.createRadialGradient(cx - 12, cy - 14, 2, cx, cy, 31);
  core.addColorStop(0, '#36558e');
  core.addColorStop(.39, '#14274f');
  core.addColorStop(.78, '#080f2b');
  core.addColorStop(1, '#070b23');
  ctx.beginPath();
  ctx.arc(cx, cy, 28.7, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
  circle(27.7, 'rgba(140,210,255,.37)', .8);

  // Chrome/glass highlight in top-left quadrant. Clip to orb boundary.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 27.5, 0, Math.PI * 2);
  ctx.clip();
  const reflection = ctx.createRadialGradient(cx - 14, cy - 18, 0, cx - 12, cy - 14, 24);
  reflection.addColorStop(0, 'rgba(234,249,255,.55)');
  reflection.addColorStop(.36, 'rgba(176,230,255,.13)');
  reflection.addColorStop(1, 'rgba(176,230,255,0)');
  ctx.fillStyle = reflection;
  ctx.fillRect(15, 15, 70, 70);
  ctx.restore();

  // Beveled, segmented dial marks: an EA BIG-era speedometer motif.
  for (const startAngle of [-1.0, 2.12]) {
    for (let i = 0; i < 3; i++) {
      const a = startAngle + i * .13;
      ctx.beginPath();
      ctx.arc(cx, cy, 37.1, a, a + .075);
      ctx.strokeStyle = i === 1 ? shine : neon;
      ctx.lineWidth = i === 1 ? 2.1 : 1.7;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
  // Mixed clusters use separate magenta and gold accents on their cyan ring.
  if (spec.tone === 'mixed') {
    for (const [start, color] of [[.55, '#ff56d6'], [3.65, '#ffc358']] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius + 1.7, start, start + .57);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.4;
      ctx.stroke();
    }
  }

  // Custom numeral artwork is baked into the orb, not a generic map font.
  const text = spec.count < 10 ? `0${spec.count}` :
    spec.count >= 1000
      ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(spec.count)
      : String(spec.count);
  ctx.save();
  ctx.translate(cx, cy + 7.7);
  ctx.transform(1, 0, -.15, 1, 0, 0); // race-sport italic even on nonitalic fallback fonts
  let fontSize = text.length > 3 ? 21 : text.length > 2 ? 26 : 29;
  ctx.font = `italic 900 ${fontSize}px Impact, "Arial Black", system-ui, sans-serif`;
  while (ctx.measureText(text).width > 49 && fontSize > 15) {
    fontSize--;
    ctx.font = `italic 900 ${fontSize}px Impact, "Arial Black", system-ui, sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0d1a43';
  ctx.lineWidth = 2.7;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = neon;
  ctx.shadowBlur = 5;
  ctx.fillText(text, 0, 0);
  ctx.restore();

  return ctx.getImageData(0, 0, px, px);
}

export function installEnergyOrbSprites(map: GLMap, seeds: readonly OrbSeed[]) {
  for (const spec of getEnergyOrbSpecs(seeds)) {
    if (map.hasImage(spec.id)) continue;
    const image = drawEnergyOrb(spec);
    if (image) map.addImage(spec.id, image, { pixelRatio: ENERGY_ORB_PIXEL_RATIO });
  }
}

/**
 * In MapLibre v6 missing sprite IDs must be resolved via this method, not
 * via the old styleimagemissing event. Counts are taken only from the real
 * cluster's point_count; this callback makes NO claim about active runners.
 *
 * Actual production activity is unpredictable, so create each real-race
 * badge on demand rather than eager-registering hundreds of unused images.
 */
export function installOnDemandRealEnergyOrbs(map: GLMap) {
  map.setMissingStyleImageResolver((id) => {
    const match = /^runnit-energy-orb-(open-race|own-race)-(\d{1,9})$/.exec(id);
    if (!match || map.hasImage(id)) return;
    const count = Number(match[2]);
    if (!Number.isSafeInteger(count) || count < 1) return;
    const image = drawEnergyOrb({ id, tone: match[1] as 'open-race' | 'own-race', count });
    if (image) map.addImage(id, image, { pixelRatio: ENERGY_ORB_PIXEL_RATIO });
  });
}
