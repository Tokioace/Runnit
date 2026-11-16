/**
 * Short original arcade SFX, generated with Web Audio (no borrowed recordings).
 * Audio is unlocked by a real user tap on READY / TON AN.
 * Visual timing always uses the server's absolute start_at timestamp.
 */
let context: AudioContext | null = null;
let isMuted = false;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || isMuted) return null;
  const AudioApi = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioApi) return null;
  try {
    if (!context || context.state === 'closed') context = new AudioApi();
    return context;
  } catch { return null; }
}

export function setRaceAudioMuted(muted: boolean) {
  isMuted = muted;
}

/** Call synchronously from the user's tap (iOS Safari gesture policy). */
export function unlockRaceAudio(): void {
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

type Stop = () => void;

function tone(ctx: AudioContext, at: number, duration: number, startHz: number, endHz: number,
  level = 0.14, wave: OscillatorType = 'sawtooth'): Stop {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(startHz, at);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), at + duration);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), at + Math.min(0.018, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.01);
  return () => { try { oscillator.stop(); } catch {} };
}

/** Three rising warning beeps, then one long green-light GO sound. */
export function scheduleArcadeStartSfx(startsAt: number): Stop {
  const ctx = audio();
  if (!ctx || ctx.state !== 'running') return () => {};
  const stops: Stop[] = [];
  const secondsUntilStart = (startsAt - Date.now()) / 1000;
  for (const [remaining, frequency] of [[3, 620], [2, 720], [1, 820]] as const) {
    const delay = secondsUntilStart - remaining;
    if (delay < -0.08) continue;
    const at = ctx.currentTime + Math.max(0, delay);
    stops.push(tone(ctx, at, 0.16, frequency, frequency * 1.05, 0.12, 'square'));
  }
  if (secondsUntilStart >= -0.08) {
    const at = ctx.currentTime + Math.max(0, secondsUntilStart);
    stops.push(tone(ctx, at, 0.65, 950, 1450, 0.18, 'sawtooth'));
    stops.push(tone(ctx, at + 0.025, 0.6, 475, 725, 0.09, 'triangle'));
  }
  return () => stops.forEach(stop => stop());
}

/** Sharp finish chime plus a short synthetic crowd-shaped noise swell. */
export function playArcadeFinishSfx(): void {
  const ctx = audio();
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime + 0.01;
  tone(ctx, now, 0.65, 1100, 1900, 0.19, 'square');
  tone(ctx, now + 0.14, 0.8, 760, 1300, 0.10, 'triangle');
  try {
    const duration = 1.8;
    const samples = Math.round(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    // Deterministic unvoiced cheering texture; no audio assets or samples.
    let seed = 23491;
    for (let i = 0; i < samples; i++) {
      seed = (seed * 16807) % 2147483647;
      const t = i / ctx.sampleRate;
      const pulse = 0.62 + 0.38 * Math.sin(2 * Math.PI * 7 * t);
      channel[i] = ((seed / 2147483647) * 2 - 1) * pulse;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(740, now + 0.15);
    filter.frequency.linearRampToValueAtTime(1500, now + duration);
    filter.Q.value = 0.7;
    const volume = ctx.createGain();
    volume.gain.setValueAtTime(0.0001, now + 0.12);
    volume.gain.linearRampToValueAtTime(0.20, now + 0.52);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(filter).connect(volume).connect(ctx.destination);
    noise.start(now + 0.12);
    noise.stop(now + duration + 0.01);
  } catch { /* Silent fallback on unavailable audio hardware. */ }
}
