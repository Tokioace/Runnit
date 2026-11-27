# Develop PR security evidence gate (read-only runbook)

This checklist is for an autonomous **single new PR** based on the exact GitHub `develop` HEAD captured at the start of its run. It is not a replacement for independent checks or an authorization to change CI, policies or production settings.

## Capture and compare identities

Record the complete initial `develop` commit SHA, the PR number, `base.ref` (must be `develop`), `base.sha`, and the complete `head.sha`. Do not take implementation code from unmerged PRs. Immediately before any merge, fetch all three values again. If `develop` moved, rebuild the candidate from current `develop`, rerun all relevant checks for its new exact head, and review the diff again. Never merge another pre-existing PR as part of this cycle.

## Required evidence for the exact candidate head

| Gate | Evidence to capture | Fail-closed condition |
| --- | --- | --- |
| TypeScript | Successful workflow job and its run URL, head SHA | Missing, skipped, cancelled, failed, or different SHA |
| Production build | Successful build job and run URL, head SHA | Vercel READY alone, missing build, or different SHA |
| Tests | Existing test suite command, counts and failures, run URL | Not run or failures unexplained |
| Independent CodeQL | CodeQL workflow/check run, conclusion, head SHA and scanning alerts reviewed | No independent scan, pending/failed scan, or unexplained relevant alerts |
| Dependency security | Audit/Dependabot findings with package, advisory, affected versions, disposition and expiry of any exception | Any high/critical finding or unsuccessful audit |
| Changed-file risk | Full diff against current develop, including generated/lock files | Secrets, auth/RLS/Supabase production config, private geolocation, deploy/CI security, major upgrades, or untested large features |
| Deployment guard | Read `docs/vercel-manual-deploy.md` from develop and inspect branch deployment policy | Uncertain production branch or feature-branch deployment side effects |

A successful combined commit status, Vercel deployment or a green Quality job **does not** establish that CodeQL ran independently. Record each separately. The historical temporary `picomatch` GHSA-fc5q-39xc-vjpf exception (original expiry 2026-12-02) is retired by the strict audit policy. The baseline audit [46061795695](https://github.com/Tokioace/Runnit/actions/runs/46061795695) reported zero runtime vulnerabilities and no full-audit high/critical findings. This is registry evidence at that time, not independent proof that the advisory was patched. The audit must now reject every high/critical finding, including any recurrence of that advisory. Review current Dependabot/CodeQL findings separately before release.

## Read-only database/privacy audit (do not mutate production)

For the merged `runner_stats_preferences` migration, inspect the migration SQL, RLS enablement and user-bound policies. Verify actual applied migration/policies only with explicitly authorized read-only access. If live status is unavailable, record **not verified**; do not infer it from a successful frontend build. Treat `SECURITY DEFINER` leaderboard functions, anonymous execute grants and opt-in visibility as separate security review items. Do not export user data, precise GPS traces or credentials to logs, comments or test fixtures.

## Field evidence remains separate

Unit tests and build cannot prove GPS accuracy, iOS background sensor delivery, or synchronized two-device results. Record device model, browser/PWA mode, test action, observed state on both devices, expected state, and reproducibility **without** storing raw location coordinates. For walking GPS-lab tests, use walking cadence and avoid classifying low walking speed or absent IMU steps alone as cheating.

## Night handoff template

- Starting develop SHA; current develop SHA; PR base/head SHA
- Scope and changed files; overlapping open PRs reviewed (not copied)
- TypeScript / build / tests / independent CodeQL / dependency audit: result + exact-head evidence URL for each
- Outstanding security alerts and exceptions, including expiry
- iPhone field tests: performed vs not performed
- Merge decision and why; no production or main change
- Next independent task, with owner/PR overlap to avoid

**Fail closed:** no automatic merge when any required evidence is missing, pending, failed, stale, or ambiguous. Do not trigger Vercel CLI/API deployments from an autonomous cycle. Keep parked redesign work untouched.
