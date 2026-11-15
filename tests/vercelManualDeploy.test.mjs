import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('Vercel automatically builds develop and main, but PR feature previews require user trigger', () => {
  assert.deepEqual(config.git?.deploymentEnabled, {
    main: true,
    develop: true,
    '**': false,
  });
  assert.equal(config.git.deploymentEnabled.develop, true);
  assert.equal(config.git.deploymentEnabled['feature/**'], undefined);
  assert.equal(config.git.deploymentEnabled['fix/**'], undefined);
  assert.equal(config.previewDeploymentsDisabled, undefined,
    'leave manual preview creation available');
  assert.equal(config.ignoreCommand, undefined,
    'ignored build scripts still create canceled deployment records');
});

test('Runnit Vite SPA continues to build and handle deep links unchanged', () => {
  assert.equal(config.framework, 'vite');
  assert.equal(config.buildCommand, 'npm run build');
  assert.equal(config.outputDirectory, 'dist');
  assert.deepEqual(config.routes, [
    { handle: 'filesystem' },
    { src: '/.*', dest: '/index.html' },
  ]);
});
