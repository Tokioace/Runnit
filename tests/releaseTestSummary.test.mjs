import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTestSummary } from '../scripts/verify-test-summary.mjs';

function report(overrides = {}) {
  const counts = {tests: 4, suites: 1, pass: 4, fail: 0, cancelled: 0, skipped: 0, todo: 0, ...overrides};
  return 'TAP version 13\n1..4\n' + Object.entries(counts).map(([k,v]) => '# ' + k + ' ' + v).join('\n') + '\n# duration_ms 12.5\n';
}

test('complete nonempty passing TAP footer is accepted', () => {
  assert.equal(verifyTestSummary(report()).pass, 4);
  assert.equal(verifyTestSummary(report().replaceAll('\n','\r\n')).tests, 4);
});

test('skipped, todo, cancelled or failed tests fail the release gate', () => {
  for (const status of ['skipped','todo','cancelled','fail']) {
    assert.throws(() => verifyTestSummary(report({pass:3,[status]:1})), /Release test gate/);
  }
});

test('empty, inconsistent, truncated or nonterminal summary is rejected', () => {
  assert.throws(() => verifyTestSummary(report({tests:0,pass:0})));
  assert.throws(() => verifyTestSummary(report({pass:3})));
  assert.throws(() => verifyTestSummary(report().replace('# skipped 0\n','')));
  assert.throws(() => verifyTestSummary(report() + 'unexpected trailing output'));
  assert.throws(() => verifyTestSummary('process exited successfully'));
});
