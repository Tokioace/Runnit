#!/usr/bin/env bash
# Run in the isolated shell directory, never in the web project's root.
set -euo pipefail
mode="${1:---compile-only}"
[[ $# -le 1 && ( "$mode" == --prepare-only || "$mode" == --compile-only ) ]] || { echo "Unknown preview mode"; exit 1; }
[[ -f capacitor.config.json && -f package-lock.json && -f www/index.html ]] || { echo "Prepared shell input required"; exit 1; }
if [[ "$mode" == --prepare-only ]]; then
  [[ ! -e ios ]] || { echo "Use a fresh preview directory; existing iOS project will not be overwritten"; exit 1; }
  # npm ci was run by the Linux preparation job.
  [[ -x ./node_modules/.bin/cap ]]
  ./node_modules/.bin/cap add ios --packagemanager SPM
  ./node_modules/.bin/cap sync ios
  python3 install-ios-vault.py ios/App/App/SceneDelegate.swift RunnitSessionVault.swift RunnitSensorProbe.swift RunnitSprintEstimator.swift
  python3 verify-ios-project.py --prepare
  swiftc -frontend -parse ios/App/App/SceneDelegate.swift
  exit 0
fi
[[ "$(uname -s)" == Darwin ]] || { echo "macOS required"; exit 1; }
xcodebuild -version
major="$(xcodebuild -version | awk '/^Xcode / {split($2,v,".");print v[1]}')"
[[ "$major" =~ ^[0-9]+$ && "$major" -ge 26 ]] || { echo "Xcode 26+ required"; exit 1; }
npm ci --ignore-scripts
# Compile exactly the project generated and checked by the preparation job.
# Do not regenerate the template or modify the permission descriptions.
python3 verify-ios-project.py --verify
plutil -lint ios/App/App/Info.plist
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$PWD/derived" CODE_SIGNING_ALLOWED=NO build
test -d derived/Build/Products/Debug-iphonesimulator/App.app
