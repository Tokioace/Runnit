import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAudit } from '../scripts/dependency-audit.mjs';

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
  assert.deepEqual(evaluateAudit({ vulnerabilities: {} }), { ok: true });
  for (const severity of ['info', 'low', 'moderate']) {
    assert.deepEqual(evaluateAudit({ vulnerabilities: { package: { severity } } }), { ok: true });
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
