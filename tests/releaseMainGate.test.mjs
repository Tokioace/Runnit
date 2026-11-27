import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const coreWorkflows = [
  'quality.yml',
  'codeql.yml',
  'dependency-security.yml',
  'duel-sql-validation.yml',
];

test('every core workflow checks pull requests targeting develop and main', () => {
  for (const name of coreWorkflows) {
    const workflow = read('.github/workflows/' + name);
    const trigger = workflow.match(/^  pull_request:\n    branches: \[([^\n]+)\]/m);
    assert.ok(trigger, name + ': expected explicit pull request branches');
    const branches = trigger[1].split(',').map(value => value.trim());
    assert.ok(branches.includes('develop'), name + ': develop must be checked');
    assert.ok(branches.includes('main'), name + ': main release PR must be checked');
  }
});

test('main commits receive the strict dependency audit without an exception', () => {
  const workflow = read('.github/workflows/dependency-security.yml');
  assert.match(workflow, /^  push:\n    branches: \[develop, main\]/m);
  assert.match(workflow, /npm audit --omit=dev --audit-level=high/);
  assert.match(workflow, /node scripts\/dependency-audit\.mjs/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
});

test('native simulator and connected test preview stay manual opt-ins', () => {
  const workflow = read('.github/workflows/ios-preview.yml');
  assert.match(workflow, /github.event_name == 'workflow_dispatch' && inputs.build_simulator/);
  assert.match(workflow, /github.event_name == 'workflow_dispatch' && inputs.test_backend/);
});

test('native preview preparation covers shared build inputs and both release target branches', () => {
  const workflow = read('.github/workflows/ios-preview.yml');
  const trigger = workflow.match(/^  pull_request:\n([\s\S]*?)(?=^  workflow_dispatch:)/m);
  assert.ok(trigger, 'missing native preview PR trigger');
  assert.match(trigger[1], /^    branches: \[develop, main\]$/m);
  const paths = [...trigger[1].matchAll(/^      - '([^']+)'$/gm)].map(match => match[1]);
  for (const path of [
    'native/ios-preview/**', '.github/workflows/ios-preview.yml',
    'scripts/build-ios-preview.sh', 'scripts/build-native-preview-web.mjs',
    'scripts/verify-ios-project.py', 'scripts/smoke-ios-preview.sh', 'scripts/install-ios-vault.py',
    'src/**', 'public/**', 'index.html', 'package.json', 'package-lock.json',
    'vite.config.*', 'tsconfig*.json', 'tailwind.config.*', 'postcss.config.*'
  ]) assert.ok(paths.includes(path), 'missing native build input: ' + path);
  assert.ok(paths.every(path => !path.startsWith('!')), 'native build inputs must not be excluded');
});
