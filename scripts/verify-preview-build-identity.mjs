import { readFileSync } from 'node:fs';
import { matchesPreviewBuildIdentity } from '../src/lib/previewBuildIdentity.ts';

try {
  const [file, commit] = process.argv.slice(2);
  if (process.argv.length !== 4 || !matchesPreviewBuildIdentity(JSON.parse(readFileSync(file, 'utf8')), commit)) {
    throw new Error('Build identity mismatch');
  }
  console.log('Preview build identity matches selected commit.');
} catch {
  console.error('Preview build identity missing, malformed or mismatched.');
  process.exitCode = 1;
}
