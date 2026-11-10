import type { MotionSample } from './fairPlay';

/** Only relative monotonic times and inertial readings; never GPS or epoch time. */
export function createWalkingImuExport(samples: readonly MotionSample[], reference: string) {
  const valid = samples.filter(s =>
    Number.isFinite(s.timestampMs) && Number.isFinite(s.accelerationMagnitudeMps2) &&
    s.accelerationMagnitudeMps2 >= 0 &&
    s.accelerationMagnitudeMps2 < 200
  );
  const origin = valid[0]?.timestampMs ?? 0;
  const referenceNumber = Number(reference);
  const referenceSteps = reference.trim() !== '' && Number.isSafeInteger(referenceNumber) &&
    referenceNumber > 0 && referenceNumber <= 100000 ? referenceNumber : null;
  return {
    schema: 'runnit-walking-imu-v1',
    referenceSteps,
    units: { time: 'ms since first valid IMU sample', acceleration: 'm/s2' },
    samples: valid.map(s => ({
      tMs: Math.round((s.timestampMs - origin) * 1000) / 1000,
      magnitude: s.accelerationMagnitudeMps2,
      x: typeof s.accelerationX === 'number' && Number.isFinite(s.accelerationX) ? s.accelerationX : null,
      y: typeof s.accelerationY === 'number' && Number.isFinite(s.accelerationY) ? s.accelerationY : null,
      z: typeof s.accelerationZ === 'number' && Number.isFinite(s.accelerationZ) ? s.accelerationZ : null,
    })),
  };
}
