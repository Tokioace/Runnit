"""Offline tests for the actual disposable SQL bundle generator and verifier."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "rehearsal", Path(__file__).with_name("build-release-rehearsal.py")
)
rehearsal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rehearsal)


class RehearsalVerificationTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        self.source = root / "source"
        self.source.mkdir()
        (self.source / "release_preflight.sql").write_text("SELECT true AS preflight_pass;\n")
        for name in rehearsal.ORDER:
            (self.source / name).write_text("SELECT 1;\n")
        self.bundle = root / "bundle"
        rehearsal.generate(self.source, self.bundle)

    def verify(self):
        rehearsal.verify(self.source, self.bundle)

    def test_original_bundle_matches(self):
        self.verify()

    def test_modified_sql_fails(self):
        with (self.bundle / "rehearse-install.sql").open("a") as file:
            file.write("-- modified\n")
        with self.assertRaisesRegex(ValueError, "differs from reviewed source"):
            self.verify()

    def test_modified_manifest_fails(self):
        (self.bundle / "manifest.json").write_text("{}")
        with self.assertRaisesRegex(ValueError, "differs from reviewed source"):
            self.verify()

    def test_source_changed_since_generation_fails(self):
        (self.source / rehearsal.ORDER[0]).write_text("SELECT 2;\n")
        with self.assertRaisesRegex(ValueError, "differs from reviewed source"):
            self.verify()

    def test_missing_and_unexpected_files_fail(self):
        (self.bundle / "unexpected.sql").write_text("SELECT 3;")
        with self.assertRaisesRegex(ValueError, "Unexpected or missing"):
            self.verify()
        (self.bundle / "unexpected.sql").unlink()
        (self.bundle / "rehearse-rollback.sql").unlink()
        with self.assertRaisesRegex(ValueError, "Unexpected or missing"):
            self.verify()

    def test_linked_artifact_fails_even_if_contents_match(self):
        original = self.bundle / "rehearse-install.sql"
        target = self.bundle.parent / "linked.sql"
        original.rename(target)
        original.symlink_to(target)
        with self.assertRaisesRegex(ValueError, "Invalid rehearsal bundle file"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
