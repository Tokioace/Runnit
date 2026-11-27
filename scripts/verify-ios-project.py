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

def read_config(path: Path):
    assert path.is_file() and not path.is_symlink(), "missing or linked Capacitor config"
    def unique(pairs):
        result = {}
        for key, value in pairs:
            assert key not in result, "duplicate Capacitor config key"
            result[key] = value
        return result
    config = json.loads(path.read_text(), object_pairs_hook=unique)
    assert isinstance(config, dict), "invalid Capacitor config"
    return config

def validate_source_config(config):
    assert config.get("appId") == "com.tokioace.runnit.preview", "unexpected bundle identifier"
    assert config.get("webDir") == "www", "unexpected web directory"
    assert config.get("server") == {"hostname": "localhost", "iosScheme": "capacitor"}, "unexpected native server configuration"
    assert config.get("ios", {}).get("webContentsDebuggingEnabled") is False, "native WebView debugging must remain disabled"
    assert config.get("loggingBehavior") == "none", "native logging must remain disabled"

def validate_native_config(source: Path, native: Path):
    expected = read_config(source)
    validate_source_config(expected)
    actual = read_config(native)
    # Capacitor CLI adds its generated iOS plugin registration list.
    assert "packageClassList" not in expected, "unexpected source plugin class list"
    classes = actual.pop("packageClassList", [])
    assert isinstance(classes, list) and all(isinstance(name, str) and name for name in classes), "invalid generated plugin class list"
    assert json.dumps(actual, sort_keys=True) == json.dumps(expected, sort_keys=True), "native Capacitor configuration mismatch"

def validate_compiled_config(source: Path, generated: Path, compiled: Path):
    validate_native_config(source, generated)
    validate_native_config(source, compiled)
    assert json.dumps(read_config(generated), sort_keys=True) == json.dumps(read_config(compiled), sort_keys=True), "compiled Capacitor configuration differs from prepared project"

def validate():
    scene = SCENE.read_text()
    assert all(scene.count(item) == 1 for item in REQUIRED), "native bridge/estimator missing or duplicate"
    assert "SceneDelegate.swift" in PROJECT.read_text(), "scene not registered in Xcode project"
    validate_native_config(ROOT / "capacitor.config.json", APP / "capacitor.config.json")
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

def validate_compiled_app(web: Path, app: Path, source_config: Path, generated_config: Path):
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
    validate_compiled_config(source_config, generated_config, app / "capacitor.config.json")

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
        validate_compiled_app(ROOT / "www", ROOT / "derived/Build/Products/Debug-iphonesimulator/App.app",
                              ROOT / "capacitor.config.json", APP / "capacitor.config.json")
    else:
        raise SystemExit("Use --prepare, --verify or --verify-built-app")
    print("Preview project structure and input integrity verified")
