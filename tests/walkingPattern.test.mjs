import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimatePatternSteps } from '../src/lib/walkingPattern.ts';

function signal(interval, steps, noise = 0.1) {
  const duration = (steps + 1) * interval;
  return Array.from({ length: Math.ceil(duration / 20) }, (_, i) => {
    const t = i * 20;
    const phase = (t % interval) / interval;
    const pulse = 3.8 * Math.exp(-Math.pow((phase - 0.45) / 0.10, 2));
    return { timestampMs: t, accelerationMagnitudeMps2: 0.4 + pulse + noise * (1 + Math.sin(i * 2.3)) };
  });
}
describe('experimental filtered walking estimator', () => {
  it('counts periodic synthetic walking without double counting minor oscillations', () => {
    const result = estimatePatternSteps(signal(600, 40));
    assert.ok(result.count >= 35 && result.count <= 42, String(result.count));
    assert.ok(result.cadenceSpm !== null && result.cadenceSpm > 90 && result.cadenceSpm < 110);
  });
  it('does not turn small stationary jitter into steps', () => {
    const stationary = Array.from({ length: 2000 }, (_, i) => ({ timestampMs: i * 20, accelerationMagnitudeMps2: 0.4 + 0.12 * Math.sin(i) }));
    assert.equal(estimatePatternSteps(stationary).count, 0);
  });
  it('rejects sparse isolated shakes and handles sensor gaps', () => {
    const spikes = [500, 2500, 5500, 9000].flatMap(t => [
      { timestampMs: t - 20, accelerationMagnitudeMps2: 0.2 },
      { timestampMs: t, accelerationMagnitudeMps2: 6 },
      { timestampMs: t + 20, accelerationMagnitudeMps2: 0.2 },
    ]);
    assert.equal(estimatePatternSteps(spikes).count, 0);
    const withGap = [...signal(600, 10), ...signal(600, 10).map(s => ({ ...s, timestampMs: s.timestampMs + 12000 }))];
    const result = estimatePatternSteps(withGap);
    assert.ok(result.count >= 16 && result.count <= 22, String(result.count));
  });
  it('ignores malformed sensor readings', () => {
    assert.equal(estimatePatternSteps([{ timestampMs: NaN, accelerationMagnitudeMps2: 3 }, { timestampMs: 5, accelerationMagnitudeMps2: Infinity }]).count, 0);
  });
});
