// Validate the terminal Node TAP summary, not merely the test process exit code.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function verifyTestSummary(output) {
  const match = /(?:^|\n)# tests (\d+)\r?\n# suites (\d+)\r?\n# pass (\d+)\r?\n# fail (\d+)\r?\n# cancelled (\d+)\r?\n# skipped (\d+)\r?\n# todo (\d+)\r?\n# duration_ms \d+(?:\.\d+)?\s*$/.exec(output);
  if (!match) throw new Error('Missing complete terminal TAP summary');
  const [tests, suites, pass, fail, cancelled, skipped, todo] = match.slice(1).map(Number);
  if (![tests, suites, pass, fail, cancelled, skipped, todo].every(Number.isSafeInteger) ||
      tests === 0 || pass !== tests || fail || cancelled || skipped || todo) {
    throw new Error('Release test gate requires a nonempty suite with every test passed and none failed, cancelled, skipped or todo');
  }
  return {tests, suites, pass, fail, cancelled, skipped, todo};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Provide exactly one TAP report path');
    const result = verifyTestSummary(readFileSync(process.argv[2], 'utf8'));
    console.log('Release test evidence: ' + result.pass + '/' + result.tests + ' passed, no skips or cancellations.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
