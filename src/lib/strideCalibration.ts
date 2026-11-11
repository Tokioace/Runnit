/**
 * Experimental walking-stride calibration. Uses straight-line displacement
 * between stationary GPS endpoint clusters, never summed GPS path jitter.
 * Height is only a plausibility prior; never a measured stride length.
 * No coordinates, device identifiers or raw motion traces are persisted.
 */
export type CalibrationFix = Readonly<{
  latitude: number;
  longitude: number;
  accuracyM: number;
  timestampMs: number;
}>;

export type WalkingCalibration = Readonly<{
  version: 1;
  heightCm: number;
  stepCount: number;
  measuredDistanceM: number;
  walkingStrideM: number;
  endpointAccuracyRatio: number;
  calibratedAt: string;
  method: 'gps-endpoints-imu';
}>;

export type CalibrationAssessment = Readonly<{
  accepted: boolean;
  reason: string;
  distanceM: number | null;
  walkingStrideM: number | null;
  heightReferenceM: number | null;
  endpointAccuracyRatio: number | null;
}>;

const EARTH_RADIUS_M = 6371000;
const MIN_STEPS = 40;
const MAX_STEPS = 90;
const MAX_FIX_ACCURACY_M = 8;
const MAX_ENDPOINT_SPREAD_M = 6;
const MAX_ACCURACY_RATIO = 0.3;

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function estimateWalkingStrideFromHeight(heightCm: number): number | null {
  return Number.isFinite(heightCm) && heightCm >= 100 && heightCm <= 230
    ? heightCm / 100 * 0.415 : null;
}

export function distanceBetweenFixes(a: CalibrationFix, b: CalibrationFix): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function cluster(fixes: readonly CalibrationFix[]): { point: CalibrationFix; spreadM: number; firstMs: number; lastMs: number } | null {
  const eligible = fixes.filter(f => Number.isFinite(f.timestampMs)
    && Number.isFinite(f.latitude) && Math.abs(f.latitude) <= 90
    && Number.isFinite(f.longitude) && Math.abs(f.longitude) <= 180
    && Number.isFinite(f.accuracyM) && f.accuracyM > 0 && f.accuracyM <= MAX_FIX_ACCURACY_M)
    .sort((a, b) => a.timestampMs - b.timestampMs);
  // Require multiple actual readings over time; repeated cached fixes do not qualify.
  const unique = eligible.filter((fix, index) => index === 0 || fix.timestampMs > eligible[index - 1].timestampMs);
  if (unique.length < 3 || unique[unique.length - 1].timestampMs - unique[0].timestampMs < 1500) return null;
  const point: CalibrationFix = {
    latitude: median(unique.map(f => f.latitude)),
    longitude: median(unique.map(f => f.longitude)),
    accuracyM: median(unique.map(f => f.accuracyM)),
    timestampMs: median(unique.map(f => f.timestampMs)),
  };
  const spreadM = Math.max(...unique.map(f => distanceBetweenFixes(f, point)));
  return { point, spreadM, firstMs: unique[0].timestampMs, lastMs: unique[unique.length - 1].timestampMs };
}

export function assessWalkingCalibration(input: {
  heightCm: number;
  stepCount: number;
  startFixes: readonly CalibrationFix[];
  endFixes: readonly CalibrationFix[];
  sensorInterrupted?: boolean;
}): CalibrationAssessment {
  const prior = estimateWalkingStrideFromHeight(input.heightCm);
  const reject = (reason: string, distanceM: number | null = null, ratio: number | null = null): CalibrationAssessment =>
    ({ accepted: false, reason, distanceM, walkingStrideM: null, heightReferenceM: prior, endpointAccuracyRatio: ratio });
  if (prior === null) return reject('Bitte eine gültige Körpergröße zwischen 100 und 230 cm eingeben.');
  if (!Number.isInteger(input.stepCount) || input.stepCount < MIN_STEPS || input.stepCount > MAX_STEPS)
    return reject('Für diesen GPS-Test sind 40 bis 90 erkannte Schritte erforderlich.');
  if (input.sensorInterrupted) return reject('Die Bewegungssensoren wurden unterbrochen. Bitte wiederholen.');
  const start = cluster(input.startFixes);
  const end = cluster(input.endFixes);
  if (!start || !end) return reject('An beiden Endpunkten mindestens 3 aktuelle GPS-Werte über 1,5 Sekunden mit ≤8 m Genauigkeit sammeln.');
  if (start.lastMs >= end.firstMs) return reject('Start- und Zielmessung dürfen sich zeitlich nicht überlappen.');
  if (start.spreadM > MAX_ENDPOINT_SPREAD_M || end.spreadM > MAX_ENDPOINT_SPREAD_M)
    return reject('GPS schwankt im Stand zu stark. Bitte eine offene Fläche wählen.');
  const distanceM = distanceBetweenFixes(start.point, end.point);
  if (distanceM < 25 || distanceM > 150) return reject('GPS-Endpunktdistanz muss 25 bis 150 Meter betragen.', distanceM);
  const ratio = (start.point.accuracyM + end.point.accuracyM) / distanceM;
  if (ratio > MAX_ACCURACY_RATIO)
    return reject('GPS-Genauigkeit ist im Verhältnis zur Strecke zu schwach. Bitte weiter gehen oder später wiederholen.', distanceM, ratio);
  const stride = distanceM / input.stepCount;
  const heightM = input.heightCm / 100;
  if (stride < heightM * 0.28 || stride > heightM * 0.7)
    return reject('Schrittlänge ist für die angegebene Körpergröße unplausibel. Bitte geradeaus gehen und erneut messen.', distanceM, ratio);
  return { accepted: true, reason: 'Plausible GPS-/IMU-Gehkalibrierung (experimentell, keine zertifizierte Genauigkeit).',
    distanceM, walkingStrideM: stride, heightReferenceM: prior, endpointAccuracyRatio: ratio };
}

export function makeWalkingCalibration(input: { assessment: CalibrationAssessment; heightCm: number; stepCount: number; nowIso: string }): WalkingCalibration {
  if (!input.assessment.accepted || input.assessment.distanceM === null
    || input.assessment.walkingStrideM === null || input.assessment.endpointAccuracyRatio === null
    || !Number.isFinite(Date.parse(input.nowIso))) throw new Error('Keine gültige Gehkalibrierung zum Speichern');
  return { version: 1, heightCm: input.heightCm, stepCount: input.stepCount,
    measuredDistanceM: Math.round(input.assessment.distanceM * 10) / 10,
    walkingStrideM: Math.round(input.assessment.walkingStrideM * 1000) / 1000,
    endpointAccuracyRatio: Math.round(input.assessment.endpointAccuracyRatio * 1000) / 1000,
    calibratedAt: input.nowIso, method: 'gps-endpoints-imu' };
}

export function getWalkingCalibration(metadata: unknown): WalkingCalibration | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>).walking_calibration;
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<WalkingCalibration>;
  return v.version === 1 && v.method === 'gps-endpoints-imu'
    && Number.isFinite(v.heightCm) && (v.heightCm as number) >= 100 && (v.heightCm as number) <= 230
    && Number.isInteger(v.stepCount) && (v.stepCount as number) >= MIN_STEPS && (v.stepCount as number) <= MAX_STEPS
    && typeof v.measuredDistanceM === 'number' && v.measuredDistanceM >= 25 && v.measuredDistanceM <= 150
    && typeof v.walkingStrideM === 'number' && v.walkingStrideM > 0 && v.walkingStrideM <= 2
    && typeof v.endpointAccuracyRatio === 'number' && v.endpointAccuracyRatio >= 0 && v.endpointAccuracyRatio <= MAX_ACCURACY_RATIO
    && typeof v.calibratedAt === 'string' && Number.isFinite(Date.parse(v.calibratedAt))
    ? v as WalkingCalibration : null;
}
