import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('native shell uses local bundled app and exact matched runtime versions',()=>{
 const c=JSON.parse(read('native/ios-preview/capacitor.config.json'));
 const p=JSON.parse(read('native/ios-preview/package.json'));
 assert.equal(c.webDir,'www');assert.equal(c.server.url,undefined);
 assert.equal(c.server.cleartext,undefined);
 assert.equal(c.server.allowNavigation,undefined);
 assert.equal(p.dependencies['@capacitor/core'],p.dependencies['@capacitor/ios']);
 assert.equal(p.dependencies['@capacitor/core'],p.devDependencies['@capacitor/cli']);
 assert.match(p.dependencies['@capacitor/core'],/^\d+\.\d+\.\d+$/);
 assert.equal(JSON.parse(read('package.json')).dependencies['@capacitor/core'],undefined);
});
test('macOS build is manual, locally ad-hoc signed and separate from production deployment',()=>{
 const flow=read('.github/workflows/ios-preview.yml');
 const script=read('scripts/build-ios-preview.sh');
 assert.match(flow,/github.event_name == 'workflow_dispatch' && inputs.build_simulator/);
 assert.match(read('scripts/build-native-preview-web.mjs'),/runnit-preview\.invalid/);
 assert.match(script,/CODE_SIGNING_ALLOWED=YES/);
 assert.match(script,/CODE_SIGNING_REQUIRED=YES/);
 assert.match(script,/CODE_SIGN_IDENTITY="-"/);
 assert.match(script,/CODE_SIGN_STYLE=Manual/);
 assert.match(script,/DEVELOPMENT_TEAM=""/);
 assert.match(script,/-sdk iphonesimulator/);
 assert.match(script,/codesign --verify/);
 assert.doesNotMatch(script,/PROVISIONING_PROFILE|Apple Distribution|iphoneos\b/);
 const verifier=read('scripts/verify-ios-project.py');
 assert.match(verifier,/NSLocationWhenInUseUsageDescription/);
 assert.match(verifier,/NSMotionUsageDescription/);
 assert.match(verifier,/NSMicrophoneUsageDescription.*UIBackgroundModes/);
 assert.doesNotMatch(script,/exportArchive/);
});

test('Linux generates the actual native project; macOS compiles the same artifact',()=>{
 const flow=read('.github/workflows/ios-preview.yml');
 const script=read('scripts/build-ios-preview.sh');
 const verifier=read('scripts/verify-ios-project.py');
 assert.match(flow,/bash build-ios-preview.sh --prepare-only/);
 assert.match(script,/cap add ios --packagemanager SPM/);
 assert.match(script,/swiftc -frontend -parse ios\/App\/App\/SceneDelegate.swift/);
 assert.doesNotMatch(flow,/fixture-scene/);
 assert.match(flow,/tar -czf/);
 assert.match(flow,/bash build-ios-preview.sh --compile-only/);
 assert.match(script,/python3 verify-ios-project.py --verify/);
 assert.match(verifier,/prepared project input changed/);
});

test('startup smoke is opt-in, simulator scoped and requires a fresh success marker',()=>{
 const flow=read('.github/workflows/ios-preview.yml');
 const script=read('scripts/smoke-ios-preview.sh');
 const vault=read('native/ios-preview/RunnitSessionVault.swift');
 assert.match(read('scripts/build-native-preview-web.mjs'),/VITE_IOS_PREVIEW_SMOKE:'true'/);
 assert.match(flow,/bash smoke-ios-preview.sh/);
 assert.match(script,/simctl create/);
 assert.match(script,/simctl launch/);
 assert.match(script,/No React\/bridge\/vault smoke marker/);
 assert.match(script,/simctl delete/);
 assert.match(vault,/#if DEBUG && targetEnvironment\(simulator\)/);
 assert.match(vault,/RUNNIT_SMOKE_NONCE/);
 assert.match(read('src/App.tsx'),/maybeRunPreviewSmoke\(import.meta.env.VITE_IOS_PREVIEW_SMOKE\)/);
});

test('native dependency graph is committed, integrity checked and never regenerated during CI',()=>{
 const p=JSON.parse(read('native/ios-preview/package.json'));
 const lock=JSON.parse(read('native/ios-preview/package-lock.json'));
 assert.equal(lock.lockfileVersion,3);
 assert.deepEqual(lock.packages[''].dependencies,p.dependencies);
 assert.deepEqual(lock.packages[''].devDependencies,p.devDependencies);
 for(const [name,entry] of Object.entries(lock.packages)){
  if(!name)continue;
  assert.match(entry.resolved,/^https:\/\/registry\.npmjs\.org\//);
  assert.match(entry.integrity,/^sha512-/);
 }
 const flow=read('.github/workflows/ios-preview.yml');
 assert.match(flow,/cp native\/ios-preview\/package\.json native\/ios-preview\/package-lock\.json/);
 assert.match(flow,/npm ci --ignore-scripts/);
 assert.match(flow,/cmp package-lock\.json/);
 assert.doesNotMatch(flow,/npm install --package-lock-only/);
});
