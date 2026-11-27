import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAudit } from '../scripts/dependency-audit.mjs';

function completeReport(vulnerabilities = {}) {
  const counts = {info:0,low:0,moderate:0,high:0,critical:0,total:0};
  for (const item of Object.values(vulnerabilities)) {
    counts[item.severity]++;
    counts.total++;
  }
  return {auditReportVersion:2,vulnerabilities,metadata:{vulnerabilities:counts}};
}

const formerlyWaived = {
  vulnerabilities: {
    picomatch: { severity: 'high', nodes: ['node_modules/vite/node_modules/picomatch'], via: [{ name: 'picomatch', url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf' }] },
    vite: { severity: 'high', nodes: ['node_modules/vite'], via: ['picomatch'] },
  },
};

test('blocks the formerly waived picomatch advisory even in dev-only dependencies', () => {
  const result = evaluateAudit(formerlyWaived);
  assert.equal(result.ok, false);
  assert.match(result.reason, /picomatch, vite/);
});

test('blocks every high or critical advisory regardless of dependency type', () => {
  for (const severity of ['high', 'critical']) {
    for (const dev of [true, false]) {
      assert.equal(evaluateAudit({ vulnerabilities: { package: { severity, dev } } }).ok, false);
    }
  }
});

test('accepts an empty report and reports below the existing high threshold', () => {
  assert.deepEqual(evaluateAudit(completeReport()), { ok: true });
  for (const severity of ['info', 'low', 'moderate']) {
    assert.deepEqual(evaluateAudit(completeReport({ package: { severity } })), { ok: true });
  }
});

test('rejects absent or malformed reports and audit transport errors', () => {
  for (const input of [null, undefined, [], {}, { error: { code: 'ENOAUDIT' } }, { vulnerabilities: null }, { vulnerabilities: [] }, { vulnerabilities: 'invalid' }, { vulnerabilities: {}, error: { code: 'ENOAUDIT' } }]) {
    assert.equal(evaluateAudit(input).ok, false);
  }
});

test('rejects invalid vulnerability entries instead of treating them as safe', () => {
  for (const value of [null, [], {}, { severity: null }, { severity: 'unknown' }, { severity: 'HIGH' }, 'high']) {
    assert.equal(evaluateAudit({ vulnerabilities: { package: value } }).ok, false);
  }
});


test('blocks incomplete or inconsistent npm v2 audit totals', () => {
  const report = completeReport();
  for (const bad of [
    {vulnerabilities:{}},
    {...report,auditReportVersion:1},
    {...report,metadata:{vulnerabilities:{...report.metadata.vulnerabilities,high:1,total:1}}},
    {...report,metadata:{vulnerabilities:{...report.metadata.vulnerabilities,low:1}}},
    {...report,metadata:{vulnerabilities:{...report.metadata.vulnerabilities,total:1}}},
  ]) assert.equal(evaluateAudit(bad).ok,false);
  assert.equal(evaluateAudit(completeReport({a:{severity:'low'},b:{severity:'moderate'}})).ok,true);
});
