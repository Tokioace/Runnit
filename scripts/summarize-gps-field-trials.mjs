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
const count = n => Number.isSafeInteger(n) && n >= 0;
const stopReasons = new Set(['finish','manual','background','pagehide','permission-denied','position-unavailable','timeout','gps-error','duration-limit']);
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };

function validateReport(report, distance) {
  requireThat(report && typeof report === 'object' && !Array.isArray(report) &&
    Object.keys(report).length === reportKeys.size && Object.keys(report).every(k => reportKeys.has(k)), 'Missing or unexpected report fields');
  requireThat(report.schema === 'runnit-gps-field-v1' && report.source === 'device-gps' &&
    report.eligibility === 'not-eligible' && report.targetMeters === distance, 'Incompatible field report');
  requireThat(typeof report.finished === 'boolean' && stopReasons.has(report.stopReason), 'Invalid finish status');
  requireThat(nonnegative(report.observedDistanceMeters) && nonnegative(report.maxSpeedMps) &&
    [report.acceptedSamples,report.rejectedSamples,report.staleFixesIgnored,report.gpsObservationGapCount].every(count) &&
    (report.observationMs === null || nonnegative(report.observationMs)), 'Invalid measurement aggregates');
  requireThat(report.gpsObservationGapCount === 0 ? report.gpsLongestObservationGapMs === null :
    positive(report.gpsLongestObservationGapMs) && report.gpsLongestObservationGapMs > 3000, 'Inconsistent GPS gaps');
  requireThat(report.disclaimer === 'Experimental device GPS data. Not valid for leaderboards or verified races.', 'Invalid field disclaimer');
  if (!report.finished) {
    requireThat(report.durationSeconds === null && report.referenceSeconds === null &&
      report.differenceSeconds === null && report.stopReason !== 'finish' && report.finishTimingMethod === null && report.crossingIntervalMs === null, 'Inconsistent unfinished report');
    return { finished: false, error: null, gap: report.gpsObservationGapCount > 0, method: null };
  }
  requireThat(report.stopReason === 'finish' && positive(report.durationSeconds) &&
    report.durationSeconds <= 300 && report.observedDistanceMeters >= distance && report.acceptedSamples >= 3, 'Invalid finish time');
  requireThat(report.finishTimingMethod === 'interpolated' ? positive(report.crossingIntervalMs) && report.crossingIntervalMs <= 3000 :
    report.finishTimingMethod === 'observed-after-gap' && report.crossingIntervalMs === null && report.gpsObservationGapCount > 0, 'Inconsistent finish timing');
  if (report.referenceSeconds === null) {
    requireThat(report.differenceSeconds === null, 'Inconsistent reference comparison');
    return { finished: true, error: null, gap: report.gpsObservationGapCount > 0, method: report.finishTimingMethod };
  }
  requireThat(positive(report.referenceSeconds) && report.referenceSeconds <= 180 &&
    Number.isFinite(report.differenceSeconds), 'Invalid reference comparison');
  const error = report.durationSeconds - report.referenceSeconds;
  requireThat(Math.abs(error - report.differenceSeconds) <= 1e-6, 'Inconsistent reference difference');
  return { finished: true, error, gap: report.gpsObservationGapCount > 0, method: report.finishTimingMethod };
}

export function summarizeFieldTrials(trials) {
  requireThat(Array.isArray(trials) && trials.length >= 30 && trials.length <= 50,
    'Record 30–50 preplanned trial slots');
  const seen = new Set();
  const groups = distances.map(distance => ({distance,planned:0,attempted:0,notRun:0,
    noExport:0,unfinished:0,finished:0,withoutReference:0,withObservationGap:0,
    interpolated:0,observedAfterGap:0,stopReasons:{},errors:[],gapErrors:[],continuousErrors:[]}));
  for (const trial of trials) {
    requireThat(trial && typeof trial === 'object' &&
      Object.keys(trial).every(k => ['id','distanceMeters','outcome','report'].includes(k)) &&
      typeof trial.id === 'string' && /^T(?:0[1-9]|[1-4][0-9]|50)$/.test(trial.id) && !seen.has(trial.id), 'Invalid or repeated trial slot');
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
    group.stopReasons[trial.report.stopReason]=(group.stopReasons[trial.report.stopReason]??0)+1;
    if(result.gap) group.withObservationGap++;
    if (!result.finished) group.unfinished++;
    else {
      group.finished++;
      if(result.method==='interpolated')group.interpolated++;
      else group.observedAfterGap++;
      if (result.error === null) group.withoutReference++;
      else {
        group.errors.push(result.error);
        (result.gap?group.gapErrors:group.continuousErrors).push(result.error);
      }
    }
  }
  requireThat(groups.every(g => g.planned >= 10), 'Plan at least ten slots per distance');
  const errorSummary = errors => ({compared:errors.length,
    meanSignedErrorSeconds:errors.length ? errors.reduce((a,b)=>a+b,0)/errors.length : null,
    meanAbsoluteErrorSeconds:errors.length ? errors.reduce((a,b)=>a+Math.abs(b),0)/errors.length : null,
    maxAbsoluteErrorSeconds:errors.length ? Math.max(...errors.map(Math.abs)) : null});
  return {
    scope:'experimental-browser-gps-only',
    acceptance:'not-assessed',
    distances:groups.map(({errors,gapErrors,continuousErrors,...g}) => ({
      ...g, ...errorSummary(errors),
      withObservationGapErrors:errorSummary(gapErrors),
      withoutObservationGapErrors:errorSummary(continuousErrors),
      unconfirmedFinishRate:g.attempted ? (g.noExport+g.unfinished)/g.attempted : null,
      unevaluableRate:g.attempted ? (g.attempted-errors.length)/g.attempted : null
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
