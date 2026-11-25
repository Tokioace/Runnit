import type { DuelMetrics } from '../db/submitDuelResult.ts';

/** Recover only the last measured finish for this account. Browser data is
 * untrusted and does not confer ranking eligibility or prove a sprint. */
export type PendingFinish = Readonly<{
  userId: string; duelId: string; timeMs: number; startedAt: number;
  targetDistanceM: number; metrics?: DuelMetrics;
}>;
const PREFIX = 'runnit:pending-finish:v1:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AGE_MS = 4 * 60 * 60 * 1000;

function finiteFields(source: Record<string, unknown>, names: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const name of names) {
    const value = source[name];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) result[name] = value;
  }
  return result;
}
function aggregateMetrics(value: unknown): DuelMetrics | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const source = value as Record<string, unknown>;
  const result: DuelMetrics = finiteFields(source, ['stepsCount','stepLengthAvgM','maxSpeedMps','maxAccelMps2','distanceM']);
  if (source.metricsJson && typeof source.metricsJson === 'object') {
    const diagnostic = source.metricsJson as Record<string, unknown>;
    const fields: Record<string, unknown> = finiteFields(diagnostic, ['avgAccuracyM','samplesUsed','rejectedSamples','staleFixes','motionCoverage','motionSamples','motionGapCount','sprintCadenceSpm']);
    if (typeof diagnostic.usedPrestartFix === 'boolean') fields.usedPrestartFix = diagnostic.usedPrestartFix;
    if (diagnostic.measurement === 'gps-displacement-v1') fields.measurement = diagnostic.measurement;
    if (typeof diagnostic.motionEvidence === 'string' && ['consistent','uncertain','incomplete'].includes(diagnostic.motionEvidence)) fields.motionEvidence = diagnostic.motionEvidence;
    fields.verification = 'unverified';
    result.metricsJson = fields;
  }
  return result;
}
export function parsePendingFinish(value: unknown, userId: string, duelId: string, now = Date.now()): PendingFinish | null {
  if (!UUID.test(userId) || !UUID.test(duelId) || !value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.userId !== userId || raw.duelId !== duelId ||
      typeof raw.startedAt !== 'number' || !Number.isFinite(raw.startedAt) ||
      typeof raw.timeMs !== 'number' || !Number.isSafeInteger(raw.timeMs) || raw.timeMs <= 0 ||
      raw.timeMs > MAX_AGE_MS || !Number.isFinite(now) || raw.startedAt + raw.timeMs > now + 2000 ||
      now - raw.startedAt > MAX_AGE_MS ||
      typeof raw.targetDistanceM !== 'number' || ![50,75,100].includes(raw.targetDistanceM)) return null;
  return { userId, duelId, startedAt: raw.startedAt, timeMs: raw.timeMs,
    targetDistanceM: raw.targetDistanceM, metrics: aggregateMetrics(raw.metrics) };
}
export function rememberPendingFinish(payload: PendingFinish): boolean {
  if (typeof window === 'undefined') return false;
  const clean = parsePendingFinish(payload, payload.userId, payload.duelId);
  if (!clean) return false;
  try { window.localStorage.setItem(PREFIX + payload.userId, JSON.stringify(clean)); return true; }
  catch { return false; }
}
export function readPendingFinish(userId: string, duelId: string): PendingFinish | null {
  if (!UUID.test(userId) || !UUID.test(duelId) || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + userId);
    if (!raw) return null;
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value?.duelId !== duelId) return null;
    const clean = parsePendingFinish(value, userId, duelId);
    if (!clean) window.localStorage.removeItem(PREFIX + userId);
    return clean;
  } catch { return null; }
}
export function forgetPendingFinish(userId: string, duelId: string): void {
  if (!UUID.test(userId) || !UUID.test(duelId) || typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(PREFIX + userId);
    if (raw && JSON.parse(raw)?.duelId === duelId) window.localStorage.removeItem(PREFIX + userId);
  } catch { /* storage may be unavailable */ }
}
