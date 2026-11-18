import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const TRACKED_ADVISORY = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
export const EXCEPTION_EXPIRES_AT = '2026-12-02T00:00:00Z';

/** Fail closed: only one already-disclosed advisory in exclusively dev-only packages. */
export function evaluateAudit(report, packageLock, now = new Date()) {
  if (!report || report.error || typeof report.vulnerabilities !== 'object' || !report.vulnerabilities ||
      !packageLock || typeof packageLock.packages !== 'object') {
    return { ok: false, reason: 'Missing or malformed npm audit or lockfile data.' };
  }

  const serious = Object.entries(report.vulnerabilities).filter(([, value]) =>
    value && (value.severity === 'high' || value.severity === 'critical'));
  if (!serious.length) return { ok: true, waived: [] };
  if (!(now instanceof Date) || Number.isNaN(now.getTime()) || now >= new Date(EXCEPTION_EXPIRES_AT)) {
    return { ok: false, reason: 'Temporary exception expired on ' + EXCEPTION_EXPIRES_AT + '.' };
  }

  const vulnerabilities = report.vulnerabilities;
  function knownDevOnly(name, ancestors = new Set()) {
    const item = vulnerabilities[name];
    if (!item || ancestors.has(name) || !Array.isArray(item.nodes) || item.nodes.length === 0 ||
        !item.nodes.every((path) => packageLock.packages[path]?.dev === true) ||
        !Array.isArray(item.via) || item.via.length === 0) return false;

    const chain = new Set(ancestors);
    chain.add(name);
    return item.via.every((cause) => {
      if (typeof cause === 'string') return knownDevOnly(cause, chain);
      return name === 'picomatch' && cause?.name === 'picomatch' && cause?.url === TRACKED_ADVISORY;
    });
  }

  const rejected = serious.map(([name]) => name).filter((name) => !knownDevOnly(name));
  if (rejected.length) return { ok: false, reason: 'Unapproved high/critical vulnerabilities: ' + rejected.join(', ') };
  return { ok: true, waived: serious.map(([name]) => name) };
}

function main() {
  const locked = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const run = spawnSync('npm', ['audit', '--audit-level=high', '--json'], {
    encoding: 'utf8', maxBuffer: 12 * 1024 * 1024,
  });
  if (run.error || (run.status !== 0 && run.status !== 1)) {
    throw new Error('npm audit failed to run (exit ' + run.status + '): ' + (run.error?.message || run.stderr));
  }
  let report;
  try { report = JSON.parse(run.stdout); } catch { throw new Error('npm audit returned no valid JSON.'); }
  const result = evaluateAudit(report, locked);
  if (!result.ok) {
    console.error('::error title=Dependency audit blocked::' + result.reason);
    process.exitCode = 1;
    return;
  }
  if (result.waived.length) {
    console.warn('::warning title=Unpatched dev-only picomatch CVE-2026-112366::' +
      result.waived.length + ' high severity npm findings trace only to GHSA-fc5q-39xc-vjpf in development dependencies. ' +
      'Not patched; temporary exception expires 2026-12-02. See ' + TRACKED_ADVISORY);
    console.warn('Known impacted dev-only packages: ' + result.waived.join(', '));
  } else {
    console.log('Full dependency audit: no high/critical findings.');
  }
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
