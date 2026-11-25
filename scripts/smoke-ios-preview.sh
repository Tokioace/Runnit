#!/usr/bin/env bash
# Optional macOS CI only. Fresh simulator, preview bundle, no real backend.
set -euo pipefail
[[ "$(uname -s)" == Darwin ]]
bundle=com.tokioace.runnit.preview
app=derived/Build/Products/Debug-iphonesimulator/App.app
[[ -d "$app" ]]
[[ "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$app/Info.plist")" == "$bundle" ]]
mkdir -p smoke
runtime_json="$(mktemp)"
device_json="$(mktemp)"
udid=""
cleanup() {
  code=$?
  trap - EXIT
  if [[ -n "$udid" ]]; then
    xcrun simctl io "$udid" screenshot smoke/simulator.png >/dev/null 2>&1 || true
    xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
    xcrun simctl delete "$udid" >/dev/null 2>&1 || true
  fi
  rm -f "$runtime_json" "$device_json"
  exit "$code"
}
trap cleanup EXIT
xcrun simctl list runtimes -j > "$runtime_json"
xcrun simctl list devicetypes -j > "$device_json"
selection="$(python3 - "$runtime_json" "$device_json" <<'PY'
import json, sys
runtimes=json.load(open(sys.argv[1]))["runtimes"]
types=json.load(open(sys.argv[2]))["devicetypes"]
def version(r):
    return tuple(int(v) for v in r["version"].split("."))
available=sorted((r for r in runtimes if r.get("isAvailable") and
                  ".iOS-" in r["identifier"] and version(r)>=(26,)),key=version,reverse=True)
assert available, "No available iOS 26+ simulator runtime"
for runtime in available:
    supported={d["identifier"] for d in runtime.get("supportedDeviceTypes",[]) if "identifier" in d}
    candidates=[d for d in types if d.get("productFamily")=="iPhone" and
                (not supported or d["identifier"] in supported)]
    if candidates:
        device=next((d for d in candidates if d["name"]=="iPhone 17"),candidates[-1])
        print(runtime["identifier"],device["identifier"])
        break
else:
    raise SystemExit("No compatible iPhone simulator")
PY
)"
read -r runtime device <<< "$selection"
udid="$(xcrun simctl create "RUNNIT CI Preview" "$device" "$runtime")"
xcrun simctl boot "$udid"
xcrun simctl bootstatus "$udid" -b
xcrun simctl install "$udid" "$app"
nonce="$(python3 -c 'import secrets; print(secrets.token_hex(16))')"
SIMCTL_CHILD_RUNNIT_SMOKE_NONCE="$nonce" xcrun simctl launch --terminate-running-process "$udid" "$bundle"
data="$(xcrun simctl get_app_container "$udid" "$bundle" data)"
marker="$data/Library/Caches/runnit-smoke-$nonce.json"
for ((i=0;i<60;i++)); do
  [[ ! -f "$marker" ]] || break
  sleep 1
done
[[ -f "$marker" ]] || { echo "No React/bridge/vault smoke marker"; exit 1; }
python3 - "$marker" "$nonce" <<'PY'
import json, sys
from pathlib import Path
result=json.loads(Path(sys.argv[1]).read_text())
assert result == {"nonce":sys.argv[2],"schema":"runnit-ios-smoke-v1",
                  "welcome":True,"sensorBridge":True,"vaultRoundTrip":True}
# Do not retain the one-time nonce in the downloadable report.
del result["nonce"]
Path("smoke/result.json").write_text(json.dumps(result,indent=2)+"\n")
print("Welcome route, sensor bridge and synthetic Keychain round trip passed")
PY
