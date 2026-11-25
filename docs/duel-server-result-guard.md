# Server-side result guard: release candidate

Status: staged SQL, **not installed**. The repository contains no isolated Supabase branch for testing. Do not run this on the linked/live project or merge it into active migrations until a disposable database test and review are complete.

Current RPC accepts any positive time once the duel has started. The candidate preserves participant authorization, row lock, idempotent retries, and two-player completion, using server-owned target and start time to reject mathematically implausible times. The 15 m/s average-speed ceiling is intentionally generous relative to human sprint performance, and 2 seconds server-time tolerance is provisional, not validated for device clock skew. Optional malformed sensor summaries are discarded rather than disqualifying a runner; zero steps alone is not cheating. Only allowlisted diagnostic data is persisted. All results remain unverified; plausible forged results are still possible. This does not remove or retroactively verify historical rankings.

## Required gate before activation
1. Run the included PostgreSQL fixture in a **fresh disposable** database with psql (never the live project), plus real-schema RLS, privilege, two-device, concurrency, clock and retry checks. Node source-contract tests do not execute SQL.
2. Create an isolated Supabase development database/branch with approval, inspect the effective RPC and migrations, then generate a versioned migration with Supabase CLI. Review the SQL diff, test it and run advisors. Do not apply to live data automatically.
3. Verify client UX for rejected times and clock mismatch; test 50/75/100 m, older clients, missing sensors, weak GPS, and network retries.
4. Design a separate trusted result eligibility layer for public rankings, including existing unverified results, without falsely certifying client telemetry.
