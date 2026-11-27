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

def validate_bundled_assets(web: Path, bundled: Path):
    """Every original web asset must be copied byte-for-byte into the native app."""
    assert web.is_dir() and not web.is_symlink(), "missing or linked web asset directory"
    assert bundled.is_dir() and not bundled.is_symlink(), "missing or linked bundled asset directory"
    assert (web / "index.html").is_file(), "missing web entry"
    for tree in (web, bundled):
        assert not any(p.is_symlink() for p in tree.rglob("*")), "linked web assets forbidden"
    for source in sorted(web.rglob("*")):
        if not source.is_file():
            continue
        relative = source.relative_to(web)
        destination = bundled / relative
        assert destination.is_file(), "missing bundled asset: " + str(relative)
        assert hashlib.sha256(source.read_bytes()).digest() == hashlib.sha256(destination.read_bytes()).digest(), "bundled asset mismatch: " + str(relative)
    # Capacitor may add its own generated support files to the bundle.

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
    validate_bundled_assets(ROOT / "www", APP / "public")
    assert "com.tokioace.runnit.preview" in PROJECT.read_text(), "preview bundle identifier missing"
    lock = json.loads((ROOT / "package-lock.json").read_text())
    for name in ("@capacitor/core", "@capacitor/ios", "@capacitor/cli"):
        assert lock["packages"]["node_modules/" + name]["version"] == "8.6.2", "Capacitor version drift"
    for name, entry in lock["packages"].items():
        if name:
            assert entry.get("resolved", "").startswith("https://registry.npmjs.org/"), "unexpected npm source"
            assert entry.get("integrity", "").startswith("sha512-"), "missing npm integrity"

def validate_compiled_app(web: Path, app: Path):
    """Check the actual compiled product before launching or packaging it."""
    assert app.is_dir() and not app.is_symlink(), "compiled app missing"
    manifest = plistlib.loads((app / "Info.plist").read_bytes())
    assert manifest.get("CFBundleIdentifier") == "com.tokioace.runnit.preview", "compiled bundle identifier mismatch"
    for key, value in PURPOSES.items():
        assert manifest.get(key) == value, "compiled permission description mismatch"
    assert not any(key in manifest for key in (
        "NSLocationAlwaysUsageDescription", "NSLocationAlwaysAndWhenInUseUsageDescription",
        "NSMicrophoneUsageDescription", "UIBackgroundModes")), "unexpected compiled background/extra permissions"
    executable = manifest.get("CFBundleExecutable")
    assert isinstance(executable, str) and executable not in ("", ".", "..") and Path(executable).name == executable, "invalid compiled executable name"
    binary = app / executable
    assert binary.is_file() and not binary.is_symlink() and binary.stat().st_size > 0, "compiled executable missing"
    validate_bundled_assets(web, app / "public")

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
    elif sys.argv[1:] == ["--verify-built-app"]:
        validate_compiled_app(ROOT / "www", ROOT / "derived/Build/Products/Debug-iphonesimulator/App.app")
    else:
        raise SystemExit("Use --prepare, --verify or --verify-built-app")
    print("Preview project structure and input integrity verified")
