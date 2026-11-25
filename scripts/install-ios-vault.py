#!/usr/bin/env python3
"""Install into the Capacitor 8.5+ generated SceneDelegate; reject unknown templates."""
from pathlib import Path
import sys

def install(scene: Path, plugin: Path, sensor: Path | None = None) -> None:
    source = scene.read_text()
    expected = "window?.rootViewController = CAPBridgeViewController()"
    # Some template versions spell the optional property without optional chaining.
    candidates = (expected, "window.rootViewController = CAPBridgeViewController()")
    matches = [item for item in candidates if source.count(item) == 1]
    if len(matches) != 1 or "RunnitBridgeViewController" in source:
        raise ValueError("Unexpected Capacitor scene template; review before compiling")
    replacement = matches[0].replace("CAPBridgeViewController()", "RunnitBridgeViewController()")
    extra = "\n\n" + sensor.read_text() if sensor else ""
    scene.write_text(source.replace(matches[0], replacement) + "\n\n" + plugin.read_text() + extra + "\n")

if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        raise SystemExit("Usage: install-ios-vault.py SceneDelegate.swift RunnitSessionVault.swift [RunnitSensorProbe.swift]")
    install(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]) if len(sys.argv) == 4 else None)
