import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const severities = new Set(['info', 'low', 'moderate', 'high', 'critical']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** No exceptions for runtime or development dependencies. Fail closed on malformed reports. */
export function evaluateAudit(report) {
  if (!isRecord(report) || report.error || !isRecord(report.vulnerabilities)) {
    return { ok: false, reason: 'Missing or malformed npm audit data.' };
  }
  const entries = Object.entries(report.vulnerabilities);
  if (entries.some(([, item]) => !isRecord(item) || !severities.has(item.severity))) {
    return { ok: false, reason: 'Missing or invalid npm audit severity.' };
  }
  const serious = entries.filter(([, item]) => item.severity === 'high' || item.severity === 'critical');
  if (serious.length) {
    return { ok: false, reason: 'High/critical vulnerabilities: ' + serious.map(([name]) => name).join(', ') };
  }
  // npm audit v2 includes a severity-count summary. A missing or contradictory
  // summary must not turn a partial response into a successful release check.
  const summary = report.metadata?.vulnerabilities;
  if (report.auditReportVersion !== 2 || !isRecord(summary)) {
    return { ok: false, reason: 'Missing npm audit v2 severity summary.' };
  }
  const counts = Object.fromEntries([...severities].map(severity => [severity, 0]));
  for (const [, item] of entries) counts[item.severity]++;
  if ([...severities].some(severity => !Number.isSafeInteger(summary[severity]) || summary[severity] !== counts[severity]) ||
      !Number.isSafeInteger(summary.total) || summary.total !== entries.length) {
    return { ok: false, reason: 'Inconsistent npm audit severity summary.' };
  }
  return { ok: true };
}

function main() {
  const run = spawnSync('npm', ['audit', '--audit-level=high', '--include=dev', '--include=optional', '--include=peer', '--json'], {
    encoding: 'utf8', maxBuffer: 12 * 1024 * 1024,
  });
  if (run.error || (run.status !== 0 && run.status !== 1)) {
    throw new Error('npm audit failed to run (exit ' + run.status + ').');
  }
  let report;
  try { report = JSON.parse(run.stdout); } catch { throw new Error('npm audit returned no valid JSON.'); }
  const result = evaluateAudit(report);
  if (!result.ok || run.status !== 0) {
    console.error('::error title=Dependency audit blocked::' + (result.reason || 'npm audit exited unsuccessfully.'));
    process.exitCode = 1;
    return;
  }
  console.log('Full dependency audit: no high/critical findings. No exceptions.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
