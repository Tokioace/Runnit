import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAudit, TRACKED_ADVISORY } from '../scripts/dependency-audit.mjs';

const now = new Date('2026-11-18T08:00:00Z');
const report = () => ({
  vulnerabilities: {
    picomatch: { severity: 'high', nodes: ['node_modules/vite/node_modules/picomatch'], via: [{ name: 'picomatch', url: TRACKED_ADVISORY }] },
    vite: { severity: 'high', nodes: ['node_modules/vite'], via: ['picomatch'] },
  },
});
const locked = () => ({ packages: {
  'node_modules/vite/node_modules/picomatch': { dev: true },
  'node_modules/vite': { dev: true },
} });

test('allows only disclosed picomatch advisory via dev-only transitive chain, with warning', () => {
  assert.deepEqual(evaluateAudit(report(), locked(), now), { ok: true, waived: ['picomatch', 'vite'] });
});

test('rejects new independent high advisory, even in a dev dependency', () => {
  const r = report();
  r.vulnerabilities.vite.via.push({ name: 'vite', url: 'https://github.com/advisories/GHSA-other' });
  assert.equal(evaluateAudit(r, locked(), now).ok, false);
});

test('rejects runtime dependency linked to known picomatch advisory', () => {
  const l = locked();
  l.packages['node_modules/vite'].dev = false;
  assert.equal(evaluateAudit(report(), l, now).ok, false);
});

test('rejects untracked or missing node paths', () => {
  const l = locked();
  delete l.packages['node_modules/vite'];
  assert.equal(evaluateAudit(report(), l, now).ok, false);
});

test('rejects unrecognized root advisory, including ones on picomatch', () => {
  const r = report();
  r.vulnerabilities.picomatch.via[0].url = 'https://github.com/advisories/GHSA-unknown';
  assert.equal(evaluateAudit(r, locked(), now).ok, false);
});

test('fails closed on expired exception', () => {
  assert.equal(evaluateAudit(report(), locked(), new Date('2026-12-02T00:00:00Z')).ok, false);
});

test('allows zero vulnerabilities after upstream patch', () => {
  assert.deepEqual(evaluateAudit({ vulnerabilities: {} }, locked(), now), { ok: true, waived: [] });
});

test('fails closed on audit errors', () => {
  assert.equal(evaluateAudit({ error: { code: 'ENOAUDIT' } }, locked(), now).ok, false);
});
