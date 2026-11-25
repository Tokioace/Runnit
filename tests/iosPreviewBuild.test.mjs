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
test('macOS build is manual, unsigned and separate from production deployment',()=>{
 const flow=read('.github/workflows/ios-preview.yml');
 const script=read('scripts/build-ios-preview.sh');
 assert.match(flow,/github.event_name == 'workflow_dispatch' && inputs.build_simulator/);
 assert.match(flow,/runnit-preview\.invalid/);
 assert.match(script,/CODE_SIGNING_ALLOWED=NO/);
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
