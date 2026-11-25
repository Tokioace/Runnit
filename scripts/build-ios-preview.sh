#!/usr/bin/env bash
# Run in the isolated shell directory, never in the web project's root.
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo "macOS required"; exit 1; }
[[ -f capacitor.config.json && -f package-lock.json && -f www/index.html ]] || { echo "Prepared shell artifact required"; exit 1; }
[[ ! -e ios ]] || { echo "Use a fresh preview directory; no existing iOS project will be overwritten"; exit 1; }
xcodebuild -version
major="$(xcodebuild -version | awk '/^Xcode / {split($2,v,".");print v[1]}')"
[[ "$major" =~ ^[0-9]+$ && "$major" -ge 26 ]] || { echo "Xcode 26+ required"; exit 1; }
npm ci --ignore-scripts
./node_modules/.bin/cap add ios --packagemanager SPM
./node_modules/.bin/cap sync ios
plist=ios/App/App/Info.plist
[[ -f "$plist" ]]
set_plist() {
  /usr/libexec/PlistBuddy -c "Set :$1 $2" "$plist" 2>/dev/null ||
    /usr/libexec/PlistBuddy -c "Add :$1 string $2" "$plist"
}
set_plist NSLocationWhenInUseUsageDescription "RUNNIT verwendet deinen Standort für die Kartensuche und experimentelle Laufmessungen."
set_plist NSMotionUsageDescription "RUNNIT verwendet Bewegungssensoren zur experimentellen Schritt- und Sprintmessung."
plutil -lint "$plist"
# Simulator only; not signed, not an archive, no App Store upload.
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$PWD/derived" CODE_SIGNING_ALLOWED=NO build
test -d derived/Build/Products/Debug-iphonesimulator/App.app
