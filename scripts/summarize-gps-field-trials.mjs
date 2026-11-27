// Offline descriptive evaluation only. No network, database, coordinates or ranking writes.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const distances = [50, 75, 100];
const reportKeys = new Set([
  'schema','source','eligibility','targetMeters','observedDistanceMeters','durationSeconds',
  'acceptedSamples','rejectedSamples','maxSpeedMps','finished','staleFixesIgnored','stopReason',
  'observationMs','crossingIntervalMs','gpsObservationGapCount','gpsLongestObservationGapMs',
  'finishTimingMethod','referenceSeconds','differenceSeconds','disclaimer'
]);
const nonnegative = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const positive = n => nonnegative(n) && n > 0;
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };

function validateReport(report, distance) {
  requireThat(report && typeof report === 'object' && !Array.isArray(report) &&
    Object.keys(report).every(k => reportKeys.has(k)), 'Unexpected report fields');
  requireThat(report.schema === 'runnit-gps-field-v1' && report.source === 'device-gps' &&
    report.eligibility === 'not-eligible' && report.targetMeters === distance, 'Incompatible field report');
  requireThat(typeof report.finished === 'boolean', 'Missing finish status');
  if (!report.finished) {
    requireThat(report.durationSeconds === null && report.referenceSeconds === null &&
      report.differenceSeconds === null && report.stopReason !== 'finish', 'Inconsistent unfinished report');
    return { finished: false, error: null };
  }
  requireThat(report.stopReason === 'finish' && positive(report.durationSeconds) &&
    report.durationSeconds <= 300, 'Invalid finish time');
  if (report.referenceSeconds === null) {
    requireThat(report.differenceSeconds === null, 'Inconsistent reference comparison');
    return { finished: true, error: null };
  }
  requireThat(positive(report.referenceSeconds) && report.referenceSeconds <= 180 &&
    Number.isFinite(report.differenceSeconds), 'Invalid reference comparison');
  const error = report.durationSeconds - report.referenceSeconds;
  requireThat(Math.abs(error - report.differenceSeconds) <= 1e-6, 'Inconsistent reference difference');
  return { finished: true, error };
}

export function summarizeFieldTrials(trials) {
  requireThat(Array.isArray(trials) && trials.length >= 30 && trials.length <= 50,
    'Record 30–50 preplanned trial slots');
  const seen = new Set();
  const groups = distances.map(distance => ({distance,planned:0,attempted:0,notRun:0,
    noExport:0,unfinished:0,finished:0,withoutReference:0,errors:[]}));
  for (const trial of trials) {
    requireThat(trial && typeof trial === 'object' &&
      Object.keys(trial).every(k => ['id','distanceMeters','outcome','report'].includes(k)) &&
      typeof trial.id === 'string' && /^T[0-9]{2}$/.test(trial.id) && !seen.has(trial.id), 'Invalid or repeated trial slot');
    seen.add(trial.id);
    const group = groups.find(g => g.distance === trial.distanceMeters);
    requireThat(group, 'Invalid trial distance');
    group.planned++;
    if (trial.outcome === 'not-run' || trial.outcome === 'failed-no-export') {
      requireThat(trial.report === null, 'Unexpected report for missing trial');
      if (trial.outcome === 'not-run') group.notRun++;
      else { group.attempted++; group.noExport++; }
      continue;
    }
    requireThat(trial.outcome === 'report', 'Invalid trial outcome');
    const result = validateReport(trial.report, group.distance);
    group.attempted++;
    if (!result.finished) group.unfinished++;
    else {
      group.finished++;
      if (result.error === null) group.withoutReference++;
      else group.errors.push(result.error);
    }
  }
  requireThat(groups.every(g => g.planned >= 10), 'Plan at least ten slots per distance');
  return {
    scope:'experimental-browser-gps-only',
    acceptance:'not-assessed',
    distances:groups.map(({errors,...g}) => ({
      ...g, compared:errors.length,
      unconfirmedFinishRate:g.attempted ? (g.noExport+g.unfinished)/g.attempted : null,
      unevaluableRate:g.attempted ? (g.attempted-errors.length)/g.attempted : null,
      meanSignedErrorSeconds:errors.length ? errors.reduce((a,b)=>a+b,0)/errors.length : null,
      meanAbsoluteErrorSeconds:errors.length ? errors.reduce((a,b)=>a+Math.abs(b),0)/errors.length : null,
      maxAbsoluteErrorSeconds:errors.length ? Math.max(...errors.map(Math.abs)) : null
    }))
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    requireThat(process.argv.length === 3, 'Provide one local trial manifest');
    console.log(JSON.stringify(summarizeFieldTrials(JSON.parse(readFileSync(process.argv[2],'utf8'))),null,2));
  } catch {
    console.error('Field trial manifest invalid or unreadable; review the documented input contract.');
    process.exitCode = 1;
  }
}
