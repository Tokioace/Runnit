"""Synthetic web asset copy regression tests; no iOS SDK needed."""
import importlib.util
import json
import plistlib
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "verify_ios_project", Path(__file__).resolve().parents[3] / "scripts/verify-ios-project.py"
)
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class BundledAssetsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.web = root / "www"
        self.bundled = root / "public"
        for tree in (self.web, self.bundled):
            (tree / "assets").mkdir(parents=True)
            (tree / "index.html").write_text("<html></html>")
            (tree / "assets/app.js").write_bytes(b"script")
            (tree / "assets/style.css").write_bytes(b"style")
            (tree / "assets/runner.png").write_bytes(b"image")

    def verify(self):
        verifier.validate_bundled_assets(self.web, self.bundled)

    def test_matching_assets_and_native_generated_support_file(self):
        (self.bundled / "capacitor.js").write_bytes(b"native")
        self.verify()

    def test_missing_nested_asset_fails(self):
        (self.bundled / "assets/style.css").unlink()
        with self.assertRaisesRegex(AssertionError, "missing bundled asset"):
            self.verify()

    def test_changed_binary_asset_fails(self):
        (self.bundled / "assets/runner.png").write_bytes(b"other")
        with self.assertRaisesRegex(AssertionError, "bundled asset mismatch"):
            self.verify()

    def test_changed_script_fails_even_when_html_is_unchanged(self):
        (self.bundled / "assets/app.js").write_bytes(b"changed")
        with self.assertRaisesRegex(AssertionError, "bundled asset mismatch"):
            self.verify()

    def test_source_and_destination_links_fail(self):
        for tree in (self.web, self.bundled):
            link = tree / "assets/linked.js"
            link.symlink_to(tree / "assets/app.js")
            with self.assertRaisesRegex(AssertionError, "linked web assets"):
                self.verify()
            link.unlink()

    def test_missing_entry_fails(self):
        (self.web / "index.html").unlink()
        with self.assertRaisesRegex(AssertionError, "missing web entry"):
            self.verify()


class CompiledAppTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.web = root / "www"
        self.app = root / "App.app"
        for folder in (self.web, self.app / "public"):
            folder.mkdir(parents=True)
            (folder / "index.html").write_bytes(b"html")
            (folder / "app.js").write_bytes(b"script")
        self.manifest = {"CFBundleIdentifier": "com.tokioace.runnit.preview",
                         "CFBundleExecutable": "App", **verifier.PURPOSES}
        self.write_manifest()
        (self.app / "App").write_bytes(b"synthetic binary")
        self.source_config = root / "capacitor.config.json"
        self.generated_config = root / "generated.json"
        self.compiled_config = self.app / "capacitor.config.json"
        self.config = {"appId": "com.tokioace.runnit.preview", "webDir": "www",
                       "server": {"hostname": "localhost", "iosScheme": "capacitor"},
                       "ios": {"webContentsDebuggingEnabled": False}, "loggingBehavior": "none"}
        self.source_config.write_text(json.dumps(self.config))
        for path in (self.generated_config, self.compiled_config):
            path.write_text(json.dumps({**self.config, "packageClassList": []}))

    def write_manifest(self):
        (self.app / "Info.plist").write_bytes(plistlib.dumps(self.manifest))

    def verify(self):
        verifier.validate_compiled_app(self.web, self.app, self.source_config, self.generated_config)

    def test_valid_compiled_app(self):
        self.verify()

    def test_wrong_bundle_id(self):
        self.manifest["CFBundleIdentifier"] = "com.example.other"
        self.write_manifest()
        with self.assertRaisesRegex(AssertionError, "compiled bundle identifier mismatch"):
            self.verify()

    def test_missing_permission(self):
        del self.manifest["NSMotionUsageDescription"]
        self.write_manifest()
        with self.assertRaisesRegex(AssertionError, "compiled permission description mismatch"):
            self.verify()

    def test_unexpected_background_permission(self):
        self.manifest["UIBackgroundModes"] = ["location"]
        self.write_manifest()
        with self.assertRaisesRegex(AssertionError, "unexpected compiled background"):
            self.verify()

    def test_missing_executable(self):
        (self.app / "App").unlink()
        with self.assertRaisesRegex(AssertionError, "compiled executable missing"):
            self.verify()

    def test_invalid_executable_path(self):
        self.manifest["CFBundleExecutable"] = "../outside"
        self.write_manifest()
        with self.assertRaisesRegex(AssertionError, "invalid compiled executable name"):
            self.verify()

    def test_corrupt_compiled_asset(self):
        (self.app / "public/app.js").write_bytes(b"corrupt")
        with self.assertRaisesRegex(AssertionError, "bundled asset mismatch"):
            self.verify()


    def test_remote_url_in_generated_config(self):
        self.generated_config.write_text(json.dumps({**self.config, "server": {"url": "https://example.invalid"}}))
        with self.assertRaisesRegex(AssertionError, "native Capacitor configuration mismatch"):
            self.verify()

    def test_debugging_enabled_only_in_compiled_config(self):
        self.compiled_config.write_text(json.dumps({**self.config, "ios": {"webContentsDebuggingEnabled": True}}))
        with self.assertRaisesRegex(AssertionError, "native Capacitor configuration mismatch"):
            self.verify()

    def test_changed_plugin_registration_in_compiled_config(self):
        self.compiled_config.write_text(json.dumps({**self.config, "packageClassList": ["UnexpectedPlugin"]}))
        with self.assertRaisesRegex(AssertionError, "compiled Capacitor configuration differs"):
            self.verify()

    def test_remote_url_in_source_and_native_copies(self):
        self.config["server"]["url"] = "https://example.invalid"
        for path in (self.source_config, self.generated_config, self.compiled_config):
            path.write_text(json.dumps(self.config))
        with self.assertRaisesRegex(AssertionError, "unexpected native server configuration"):
            self.verify()

    def test_missing_compiled_config(self):
        self.compiled_config.unlink()
        with self.assertRaisesRegex(AssertionError, "missing or linked Capacitor config"):
            self.verify()

    def test_duplicate_native_config_key(self):
        self.compiled_config.write_text('{"server": {}, "server": {}}')
        with self.assertRaisesRegex(AssertionError, "duplicate Capacitor config key"):
            self.verify()

    def test_config_serialization_order_is_not_significant(self):
        self.compiled_config.write_text(json.dumps({"packageClassList": [], **self.config}, sort_keys=True, indent=2))
        self.verify()


if __name__ == "__main__":
    unittest.main()
