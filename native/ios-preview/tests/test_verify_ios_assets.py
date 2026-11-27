"""Synthetic web asset copy regression tests; no iOS SDK needed."""
import importlib.util
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


if __name__ == "__main__":
    unittest.main()
