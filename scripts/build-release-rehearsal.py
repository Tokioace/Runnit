#!/usr/bin/env python3
"""Build reviewable, disposable-CI-only SQL bundles. Never connect to a database."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import tempfile

ORDER = (
    "duel_result_guard.sql", "beta_ranking_guard.sql",
    "account_deletion_requests.sql", "account_erasure_guard.sql",
    "shared_duel_erasure.sql", "session_access_guard.sql",
)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def generate(source, output):
    output.mkdir(parents=True, exist_ok=False)
    inputs = {}
    bodies = []
    for name in ("release_preflight.sql", *ORDER):
        raw = (source / name).read_bytes()
        inputs[name] = digest(raw)
        sql = raw.decode("utf-8").strip()
        # Conservative source contract: current candidates own no transaction
        # and require no psql meta-command. Not a general-purpose SQL parser.
        if re.search(r"(?im)^\s*(?:BEGIN|COMMIT|ROLLBACK|START TRANSACTION|END TRANSACTION)\s*;", sql):
            raise ValueError("Candidate owns transaction: " + name)
        if re.search(r"(?m)^\s*\\", sql):
            raise ValueError("Unexpected psql command: " + name)
        if name == "release_preflight.sql":
            if not sql.endswith(";"):
                raise ValueError("Preflight must end in semicolon")
            preflight = sql[:-1]
        else:
            bodies.append("-- Source: " + name + "\n" + sql)
    prefix = """-- DISPOSABLE CI REHEARSAL ONLY. NOT A PRODUCTION MIGRATION.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $runnit_bundle_guard$
BEGIN
 IF current_database() <> 'runnit_schema_test' OR current_user <> 'postgres'
    OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='runnit_rehearsal_fixture') THEN
  RAISE EXCEPTION 'Disposable CI fixture required';
 END IF;
END
$runnit_bundle_guard$;
-- Keep the baseline stable throughout this isolated rehearsal.
LOCK TABLE auth.users, auth.sessions, public.users, public.duels,
 public.duel_results, public.ghost_runs, public.ghost_run_sessions,
 public.runner_stats_preferences IN ACCESS EXCLUSIVE MODE;
DO $runnit_bundle_preflight$
DECLARE passed boolean;
BEGIN
 SELECT preflight_pass INTO STRICT passed FROM (
""" + preflight + """
 ) AS checks;
 IF passed IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Release preflight failed';
 END IF;
END
$runnit_bundle_preflight$;
"""
    payload = prefix + "\n\n".join(bodies) + "\n"
    outputs = {}
    for name, ending in (("rehearse-rollback.sql", "ROLLBACK;"), ("rehearse-install.sql", "COMMIT;")):
        raw = (payload + ending + "\n").encode("utf-8")
        (output / name).write_bytes(raw)
        outputs[name] = digest(raw)
    manifest = {"scope": "disposable-ci-only", "order": list(ORDER),
                "input_sha256": inputs, "output_sha256": outputs}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

def verify(source, bundle):
    """Rebuild from reviewed source and compare every artifact, not just its manifest."""
    expected_names = {"manifest.json", "rehearse-install.sql", "rehearse-rollback.sql"}
    if bundle.is_symlink() or not bundle.is_dir():
        raise ValueError("Expected a regular rehearsal bundle directory")
    if {item.name for item in bundle.iterdir()} != expected_names:
        raise ValueError("Unexpected or missing rehearsal bundle files")
    with tempfile.TemporaryDirectory() as tmp:
        expected = Path(tmp) / "expected"
        generate(source, expected)
        for name in sorted(expected_names):
            actual = bundle / name
            if actual.is_symlink() or not actual.is_file():
                raise ValueError("Invalid rehearsal bundle file: " + name)
            if actual.read_bytes() != (expected / name).read_bytes():
                raise ValueError("Rehearsal bundle differs from reviewed source: " + name)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("db/release-candidates"))
    operation = parser.add_mutually_exclusive_group(required=True)
    operation.add_argument("--output", type=Path)
    operation.add_argument("--verify", type=Path)
    args = parser.parse_args()
    if args.verify is not None:
        verify(args.source, args.verify)
        print("Disposable rehearsal bundle matches reviewed source")
    else:
        generate(args.source, args.output)
