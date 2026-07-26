# Creator Intelligence RLS — Validation Report

**Date:** 26 July 2026  
**Environment:** Development only (`hsxrewjcbvmbkqdlzjhs` / thinkway-dev)  
**Production:** Not migrated · Not deployed  
**Related:** SEC-003 · Assessment `CREATOR_INTELLIGENCE_RLS_ASSESSMENT_2026-07-26.md`

---

## Artifacts

| Artifact | Path |
|----------|------|
| Forward migration | `supabase/migrations/20260726120000_creator_intelligence_rls_least_privilege.sql` |
| Rollback (manual) | `supabase/migrations/rollback/20260726120000_creator_intelligence_rls_least_privilege.down.sql` |
| Regression SQL | `supabase/tests/rls/creator_intelligence_rls_regression.sql` |
| Dev apply helper | `scripts/psql-development.mjs` (allow-lists Dev ref only) |

---

## What changed (Development)

1. Helpers (Finance-style):
   - `can_read_creator_intelligence()` — `is_admin()` OR (`is_internal_user()` AND discovery/intelligence permissions)
   - `can_write_creator_intelligence()` — internal + `discovery.write` / `discovery.admin`
   - `can_write_creator_dna_for_influencer` / `_discovered` — write helper + internal owner path
2. Replaced all CI-core `SELECT … USING (true)` policies with permission-based SELECT.
3. DNA INSERT/UPDATE re-bound to write helpers (portal excluded via `is_internal_user()`).
4. No authenticated write policies on IPL / projection / enrichment / forecast tables (service_role only).
5. `FORCE ROW LEVEL SECURITY` on all 12 core CI tables.
6. Grant hygiene: revoked authenticated INSERT/UPDATE/DELETE on service-written tables; revoked DELETE on DNA.

---

## Apply record (Development)

| Step | Result |
|------|--------|
| Target project assert | `hsxrewjcbvmbkqdlzjhs` only (blocked Prod / legacy refs) |
| Migration applied | Yes (psql `-f`) |
| `schema_migrations` | `20260726120000` / `creator_intelligence_rls_least_privilege` |
| Regression suite | **PASS** (see below) |
| Production apply | **Not performed** |

---

## Regression results

Command:

```bash
node scripts/psql-development.mjs -f supabase/tests/rls/creator_intelligence_rls_regression.sql
```

| Case | Result |
|------|--------|
| FORCE RLS on all CI core tables | PASS |
| No `USING (true)` on sampled CI tables | PASS |
| Campaign Intelligence SELECT policy present (unaffected) | PASS |
| AI Search warehouse helper `intelligence.can_read_intelligence` intact | PASS |
| Portal user denied CI read/write | PASS |
| Internal user without discovery permission denied | PASS |
| Internal user with discovery permission allowed (incl. DNA update) | PASS |
| Viewer denied | PASS |
| Service role write allowed (worker path) | PASS |

Final notice: `CI RLS regression suite completed successfully.`

---

## Product impact (expected)

| Surface | Expected after hardening |
|---------|--------------------------|
| Discovery / DNA UI | Unchanged for roles with `discovery.read`/`write` (AM, ops, admin, finance grants) |
| AI Search warehouse | Unchanged (`intelligence.*` policies untouched) |
| Campaign Intelligence | Unchanged (CIP policies untouched) |
| Forecasting loaders (user JWT) | Require discovery/intelligence read — same staff roles |
| Discovery worker / enrichment / IPL | Unchanged (`service_role` bypasses RLS) |
| Client / Creator portals | Direct REST/SDK SELECT now returns empty / denied (intended) |

---

## Rollback (Development only)

```bash
node scripts/psql-development.mjs -f supabase/migrations/rollback/20260726120000_creator_intelligence_rls_least_privilege.down.sql
```

Restores permissive `USING (true)` SELECTs, clears FORCE RLS, drops helpers, deletes migration version row.

---

## Production gate (not done)

Do **not** apply until:

1. Explicit Production approval  
2. CLI / apply target asserted as `ienowhwfyxoqtzbgltno`  
3. Regression re-run against Production after apply  
4. Smoke: Discovery browse, DNA panel, CIP, forecast profile, worker enrichment job  

---

## Constraints honored

- Development environment only  
- No Production migration  
- No Production deployment  
- Finance authorization architecture followed (`is_internal_user` + permission helpers + FORCE RLS)  
