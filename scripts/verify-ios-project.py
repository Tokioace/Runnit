#!/usr/bin/env python3
"""Validate generated preview project and record its exact inputs; no credentials."""
import hashlib
import json
import plistlib
from pathlib import Path
import sys

ROOT = Path(".")
APP = ROOT / "ios/App/App"
PLIST = APP / "Info.plist"
SCENE = APP / "SceneDelegate.swift"
PROJECT = ROOT / "ios/App/App.xcodeproj/project.pbxproj"
MANIFEST = ROOT / "preview-input-hashes.json"
PURPOSES = {
    "NSLocationWhenInUseUsageDescription": "RUNNIT verwendet deinen Standort für die Kartensuche und experimentelle Laufmessungen.",
    "NSMotionUsageDescription": "RUNNIT verwendet Bewegungssensoren zur experimentellen Schritt- und Sprintmessung.",
}
REQUIRED = ("RunnitBridgeViewController()", "registerPluginInstance(RunnitSessionVault())",
            "registerPluginInstance(RunnitSensorProbe())", "struct RunnitSprintEstimator",
            "struct RunnitMotionCapture")

def validate():
    scene = SCENE.read_text()
    assert all(scene.count(item) == 1 for item in REQUIRED), "native bridge/estimator missing or duplicate"
    assert "SceneDelegate.swift" in PROJECT.read_text(), "scene not registered in Xcode project"
    config = json.loads((ROOT / "capacitor.config.json").read_text())
    assert config["appId"] == "com.tokioace.runnit.preview", "unexpected bundle identifier"
    assert config["webDir"] == "www" and "url" not in config.get("server", {}), "remote app forbidden"
    assert config.get("loggingBehavior") == "none", "native logging must remain disabled"
    manifest = plistlib.loads(PLIST.read_bytes())
    for key, value in PURPOSES.items():
        assert manifest.get(key) == value, "permission description missing"
    assert not any(key in manifest for key in (
        "NSLocationAlwaysUsageDescription", "NSLocationAlwaysAndWhenInUseUsageDescription",
        "NSMicrophoneUsageDescription", "UIBackgroundModes")), "unexpected background/extra permissions"
    assert (APP / "public/index.html").read_bytes() == (ROOT / "www/index.html").read_bytes(), "bundled entry mismatch"
    assert "com.tokioace.runnit.preview" in PROJECT.read_text(), "preview bundle identifier missing"
    lock = json.loads((ROOT / "package-lock.json").read_text())
    for name in ("@capacitor/core", "@capacitor/ios", "@capacitor/cli"):
        assert lock["packages"]["node_modules/" + name]["version"] == "8.6.2", "Capacitor version drift"
    for name, entry in lock["packages"].items():
        if name:
            assert entry.get("resolved", "").startswith("https://registry.npmjs.org/"), "unexpected npm source"
            assert entry.get("integrity", "").startswith("sha512-"), "missing npm integrity"

def hashes():
    files = [ROOT / "package.json", ROOT / "package-lock.json", ROOT / "capacitor.config.json",
             ROOT / "build-ios-preview.sh", ROOT / "verify-ios-project.py", ROOT / "smoke-ios-preview.sh"]
    for folder in (ROOT / "www", ROOT / "ios"):
        files.extend(p for p in folder.rglob("*") if p.is_file() and not p.is_symlink())
    return {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}

if __name__ == "__main__":
    if sys.argv[1:] == ["--prepare"]:
        assert not MANIFEST.exists(), "already prepared"
        manifest = plistlib.loads(PLIST.read_bytes())
        manifest.update(PURPOSES)
        PLIST.write_bytes(plistlib.dumps(manifest, sort_keys=False))
        validate()
        MANIFEST.write_text(json.dumps(hashes(), indent=2, sort_keys=True) + "\n")
    elif sys.argv[1:] == ["--verify"]:
        validate()
        assert json.loads(MANIFEST.read_text()) == hashes(), "prepared project input changed"
    else:
        raise SystemExit("Use --prepare or --verify")
    print("Preview project structure and input integrity verified")
