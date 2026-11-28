# Server-side result guard: release candidate

Status: staged SQL, **not installed**. The repository contains no isolated Supabase branch for testing. Do not run this on the linked/live project or merge it into active migrations until a disposable database test and review are complete.

Current RPC accepts any positive time once the duel has started. The candidate preserves participant authorization, row lock, idempotent retries, and two-player completion, using server-owned target and start time to reject mathematically implausible times. The 15 m/s average-speed ceiling is intentionally generous relative to human sprint performance, and 2 seconds server-time tolerance is provisional, not validated for device clock skew. Optional malformed sensor summaries are discarded rather than disqualifying a runner; zero steps alone is not cheating. Only allowlisted diagnostic data is persisted. All results remain unverified; plausible forged results are still possible. This does not remove or retroactively verify historical rankings.

## Required gate before activation
1. Run the included PostgreSQL fixture in a **fresh disposable** database with psql (never the live project), plus real-schema RLS, privilege, two-device, concurrency, clock and retry checks. Node source-contract tests do not execute SQL.
2. Create an isolated Supabase development database/branch with approval, inspect the effective RPC and migrations, then generate a versioned migration with Supabase CLI. Review the SQL diff, test it and run advisors. Do not apply to live data automatically.
3. Verify client UX for rejected times and clock mismatch; test 50/75/100 m, older clients, missing sensors, weak GPS, and network retries.
4. Design a separate trusted result eligibility layer for public rankings, including existing unverified results, without falsely certifying client telemetry.

## Isolated CI test
The dedicated PostgreSQL 16 service executes the SQL fixture in an ephemeral database without Supabase credentials. It checks actual anon/authenticated role execution, direct writes, valid submissions, invalid times, sanitized metrics, idempotency and two-runner completion. This does not replace real-schema and concurrency testing. The linked Supabase schema and active RPC were inspected read-only; no data or settings changed.

Read-only catalog inspection found that existing lifecycle triggers normalize created_at/expires_at/matched_at and reject non-open initial state, but authenticated users currently have INSERT on start_at and ready flags. The staged candidate now restricts INSERT columns to the exact five used by createDuel.ts. Existing join/ready functions are unchanged; test the real Supabase API create/join/ready flow before activation. The isolated fixture tests allowed creation and denied direct clock/ready inserts. No live privileges were changed.
