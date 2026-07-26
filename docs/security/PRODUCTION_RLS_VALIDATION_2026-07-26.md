# Production RLS Validation Report

**Date:** 2026-07-26  
**Control:** P0-6 — Production Creator Intelligence RLS  
**Verdict:** **PASS**

## Impact assessment

| Change | Impact | Mitigation |
|---|---|---|
| Apply CI least-privilege RLS on Production | Portal/client JWTs lose direct CI table SELECT (intended) | Matches Development behaviour; regression proves portal deny |
| Internal staff with discovery/intelligence permissions | Continue read/write as designed | Regression: AM/ops with discovery allowed |
| Discovery worker / service_role | Unaffected (RLS bypass) | Regression: service role write PASS |
| Downtime | None material (~9s DDL apply) | No Vercel redeploy required for DB policy change |

Transparent to Vercel hosting; authz tightens for portal PostgREST paths only.

## Actions

1. Applied `supabase/migrations/20260726120000_creator_intelligence_rls_least_privilege.sql` via `scripts/psql-production.mjs` (allow-lists `ienowhwfyxoqtzbgltno` only; blocks Development).
2. Ran `supabase/tests/rls/creator_intelligence_rls_regression.sql` on Production.

Target assert: `{"target":"production","ref":"ienowhwfyxoqtzbgltno",...}`

## Regression results (Production)

| Case | Result |
|---|---|
| FORCE RLS on CI core tables | **PASS** |
| No `USING (true)` SELECT on sampled CI tables | **PASS** |
| Campaign Intelligence SELECT policy present (unaffected) | **PASS** |
| AI Search warehouse helper intact | **PASS** |
| Portal user denied CI read/write | **PASS** |
| Internal without discovery permission denied | **PASS** |
| Internal with discovery permission allowed | **PASS** |
| Viewer denied | **PASS** |
| Service role write allowed (worker) | **PASS** |

Final notice: `CI RLS regression suite completed successfully.`  
Exit code: **0**

## Validation matrix

| Requirement | Status |
|---|---|
| Apply approved Dev RLS migration to Production | **PASS** |
| Execute Production regression suite | **PASS** |
| Internal workflows continue | **PASS** (permissioned internals + service_role) |
| Portal users remain denied | **PASS** |
| Production behaviour matches Development | **PASS** (same suite) |

## Artifacts

| Artifact | Path |
|---|---|
| Migration | `supabase/migrations/20260726120000_creator_intelligence_rls_least_privilege.sql` |
| Rollback | `supabase/migrations/rollback/20260726120000_creator_intelligence_rls_least_privilege.down.sql` |
| Regression | `supabase/tests/rls/creator_intelligence_rls_regression.sql` |
| Prod apply helper | `scripts/psql-production.mjs` |

## Deliverable status

P0-6 complete. All sequential P0 controls from this run are closed (P0-5 retains PITR enablement as residual gap).
