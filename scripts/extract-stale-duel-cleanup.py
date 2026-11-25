#!/usr/bin/env python3
"""Extract the exact checked-in cleanup function and ACLs, without scheduling jobs.
CI has no pg_cron extension; do not silently substitute a mock scheduler.
"""
import sys
from pathlib import Path

source = Path(sys.argv[1]).read_text()
start = "CREATE OR REPLACE FUNCTION public.runnit_close_stale_duels()"
stop = "-- Idempotent by name;"
if source.count(start) != 1 or source.count(stop) != 1:
    raise SystemExit("Unexpected cleanup SQL structure")
before, rest = source.split(start, 1)
body, after = rest.split(stop, 1)
if "CREATE EXTENSION IF NOT EXISTS pg_cron" not in before:
    raise SystemExit("Expected scheduler extension missing")
expected = ("SELECT cron.schedule(", "'runnit-expire-open-and-abandoned-duels'",
            "'* * * * *'", "'SELECT public.runnit_close_stale_duels();'")
if not all(item in after for item in expected) or after.count("cron.schedule(") != 1:
    raise SystemExit("Unexpected cron registration")
if "cron." in body:
    raise SystemExit("Cleanup function unexpectedly depends on scheduler")
print(start + body, end="")
