# Bootstrap Validation Report

**Sprint:** Bootstrap Hardening  
**Date:** 2026-07-25  
**Result:** PASSED  
**Method:** Empty PostgreSQL 16 (Docker) + `node scripts/bootstrap-empty-database.mjs --docker tw-bootstrap-pg`  
**Constraint:** No application behaviour changes; no feature removal; backward-compatible with existing development DBs (idempotent DDL / CREATE OR REPLACE).

---

## Canonical empty-database order

1. `supabase/bootstrap/supabase_platform_stubs.sql` — **only** when `auth` / `storage` are missing (plain Postgres). Skipped on real Supabase.
2. `supabase/schema.sql`
3. `supabase/seed.sql` (RBAC + document sequences; demo block remains commented)
4. `supabase/policies.sql`
5. `supabase/storage.sql` (baseline buckets + policies)
6. All `supabase/migrations/*.sql` (176 files, lexicographic / version order)

Orchestrator: `scripts/bootstrap-empty-database.mjs`

---

## Final replay log

| Status | Count |
|--------|------:|
| ok | 181 (stubs + schema + seed + policies + storage + 176 migrations) |
| fail | 0 |

**Result: PASSED — full replay succeeded without manual intervention.**

---

## Issues found and resolved

### B1 — Invoice wipe inside lifecycle migration (pre-sprint / production safety)

| | |
|--|--|
| **Symptom** | `20260605010000_vendor_io_invoice_lifecycle.sql` deleted all invoices/payments on apply |
| **Impact** | Catastrophic on populated DB; inappropriate for automatic migrate |
| **Fix** | Removed wipe from migration; moved to `scripts/manual/one_time_invoice_payment_cleanup.sql` (commented, manual-only) |
| **Commit theme** | Extract one-time invoice/payment cleanup |

### B2 — Duplicate migration version

| | |
|--|--|
| **Symptom** | Two files shared `20260723120000` |
| **Impact** | Ambiguous Supabase migration history |
| **Fix** | Renamed shortlist currency migration → `20260723120100_shortlist_display_currency.sql` |
| **Commit theme** | Uniquify migration version |

### B3 — `policies.sql` before hierarchy/billing (blocker)

| | |
|--|--|
| **Symptom** | Invoice policies referenced `campaign_header_id` and `can_access_campaign_header()` |
| **Impact** | `CREATE POLICY` failed on schema-only baseline |
| **Fix** | Baseline policies use legacy `campaign_id` only; header checks restored by `20260531610000` / `20260531620000` |
| **Commit theme** | Baseline policies bootstrap-safe |

### B4 — `campaigns` TABLE vs compatibility VIEW (blocker)

| | |
|--|--|
| **Symptom** | `schema.sql` creates TABLE `campaigns`; `20260531140000` did `CREATE OR REPLACE VIEW campaigns` |
| **Impact** | ERROR: relation already exists / cannot replace table with view |
| **Fix** | If `campaigns` is a base table, rename to `campaigns_legacy` (FK targets preserved), then create view. No-op when already a view (dev DB) |
| **Commit theme** | Safe campaigns table→view transition |

### B5 — Storage buckets missing before policies

| | |
|--|--|
| **Symptom** | `storage.sql` created policies only; buckets created later in migrations; header said “after migrations” |
| **Impact** | Ordering confusion; buckets absent during baseline storage apply |
| **Fix** | Idempotent `INSERT INTO storage.buckets` for `client-documents`, `influencer-documents`, `creator-imports`; header updated for schema→seed→policies→storage→migrations |
| **Commit theme** | Baseline storage buckets |

### B6 — `write_audit_log()` used before definition (blocker)

| | |
|--|--|
| **Symptom** | `20260531160000` / `20260531180000` call `write_audit_log()`; function first created in `20260531240000` |
| **Impact** | Trigger creation failed |
| **Fix** | Define `write_audit_log()` in `schema.sql` (same body later migrations REPLACE) |
| **Commit theme** | Baseline write_audit_log |

### B7 — `extensions` schema missing for unaccent (blocker)

| | |
|--|--|
| **Symptom** | `CREATE EXTENSION unaccent WITH SCHEMA extensions` without schema |
| **Impact** | Failed on plain Postgres / incomplete stubs |
| **Fix** | `CREATE SCHEMA IF NOT EXISTS extensions` in migration + stubs |
| **Commit theme** | Ensure extensions schema |

### B8 — No repo-owned empty-DB orchestrator

| | |
|--|--|
| **Symptom** | Bootstrap required tribal knowledge / SQL Editor manual steps |
| **Fix** | `scripts/bootstrap-empty-database.mjs` + `supabase/bootstrap/supabase_platform_stubs.sql` |
| **Commit theme** | Bootstrap harness |

---

## Backward compatibility notes

- **Existing thinkway-dev:** Already past these migrations. Edits use `IF NOT EXISTS` / `CREATE OR REPLACE` / conditional rename so re-apply is a no-op when the view already exists.
- **Migration checksums:** If Supabase CLI reports checksum drift for edited historical migrations, run `supabase migration repair` for those versions on environments that already applied the old file bodies (document in deploy runbook).
- **App behaviour:** Unchanged — schema end-state matches intended hierarchy (campaigns as view over `campaign_headers`), invoice RLS header checks still applied by later migrations, storage buckets unchanged.

---

## How to reproduce

```bash
# Local empty Postgres (example)
docker run -d --name tw-bootstrap-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=thinkway \
  -p 55432:5432 postgres:16-alpine

node scripts/bootstrap-empty-database.mjs --docker tw-bootstrap-pg

# Real empty Supabase project (auth/storage already present)
node scripts/bootstrap-empty-database.mjs --database-url "$SUPABASE_DB_URL" --skip-stubs
# Then optionally: npx supabase db push   # if you prefer CLI history marking
```

On Supabase-hosted empty projects, prefer: run baseline SQL (schema→seed→policies→storage) once, then `npx supabase db push --include-all` so `schema_migrations` is populated. The Node orchestrator applies the same SQL without writing Supabase migration history rows unless you also use the CLI.

---

## Residual / operational follow-ups (non-blocking for replay)

1. Record baseline files in `supabase_migrations` or squash into `20260531000000_baseline_core.sql` (engineering follow-up).
2. After editing already-applied migrations, repair checksums on long-lived environments.
3. Staging smoke: app login, `/api/ready`, `/operations` against a bootstrapped project.
