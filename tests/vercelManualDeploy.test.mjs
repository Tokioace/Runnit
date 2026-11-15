import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('Vercel builds previews only by explicit developer/user trigger', () => {
  assert.deepEqual(config.git?.deploymentEnabled, {
    main: true,
    '**': false,
  });
  assert.equal(config.git.deploymentEnabled.develop, undefined);
  assert.equal(config.previewDeploymentsDisabled, undefined,
    'do not disable preview creation from a branch via the Dashboard');
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
