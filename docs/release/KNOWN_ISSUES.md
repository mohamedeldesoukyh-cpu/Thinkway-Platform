# Known Issues — Release 1.0 RC (Phase 0.4)

**Date:** 2026-07-04  
**Severity key:** P0 = release blocker | P1 = must fix before GA | P2 = acceptable for internal pilot

---

## P1 — Environment & tooling

### KI-001: Windows Node.js TLS certificate verification
- **Symptom:** CLI validators fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` / `TLS connected but certificate not authorized` when calling Supabase without bypass.
- **Workaround:** `NODE_TLS_REJECT_UNAUTHORIZED=0` or `NODE_OPTIONS=--use-system-ca`.
- **Impact:** CI/local scripts on Windows behind SSL inspection; browsers and workers unaffected.
- **Affected:** ERS-2 (without bypass), creator-integrity live scenarios.

### KI-002: No dedicated staging environment
- **Symptom:** UAT ran on `localhost:3000` + thinkway-dev Supabase only.
- **Impact:** Staging-specific config (Vercel preview, staging Redis, staging secrets) not validated.
- **Status:** Documented in BLOCKERS.md.

---

## P1 — Data & migrations

### KI-003: IPL refresh policies seed missing
- **Symptom:** `validate-ipl.ts` fails "No apify policies found (migration pending?)". Tables `ipl_refresh_policies`, `ipl_provider_runs` not in schema cache.
- **Impact:** IPL cache-first path uses defaults; provider run audit incomplete.
- **Validator:** 12/13 PASS.

### KI-004: Campaign object persistence — zero rows
- **Symptom:** `campaign_objects` and `campaign_object_versions` tables accessible but empty after UAT.
- **Impact:** Phase 0.3 schema verified; end-to-end autosave → DB row not confirmed in this run (runtime restore uses conversation store, not necessarily persisted campaign_objects).
- **Action:** Run BabyJoy workflow and verify row insert before GA.

### KI-005: Discovery worker schema drift
- **Symptom:** Worker logs `stuck-status recovery failed column creator_import_files.updated_at does not exist`.
- **Impact:** Stuck import recovery disabled; worker otherwise operational.
- **Fix:** Migration `20260723130000_creator_import_files_updated_at.sql` adds `updated_at` + `set_updated_at` trigger. Apply with `npx supabase db push` (or your usual migrate path), then restart discovery-worker.

---

## P2 — Queue & worker health

### KI-006: Failed jobs in BullMQ queues
- **Symptom:** `/api/ready` reports 23 failed jobs (discovery-run: 16, publication-metrics: 7).
- **Impact:** Historical failures; queues currently idle (0 active/waiting).
- **Action:** Investigate and clean failed jobs before production cutover.

---

## P2 — Security validator false positives

### KI-007: Phase 0.1 flags public health routes as P0
- **Symptom:** `validate-security-phase01.ts` reports P0 for `/api/health`, `/api/ready`, `/api/version` missing auth.
- **Resolution:** Phase 0.2 explicitly requires these as **public** probes for load balancers and k8s. Update Phase 0.1 validator to exclude probe routes or downgrade to informational.

---

## P2 — Runtime & UX

### KI-008: ERS-3 luxury scenario uses Rolex proxy
- **Symptom:** ERS-3 validates luxury structured data via `rolex` scenario ID, not `luxury-hotel-dubai`.
- **Impact:** Cosmetic test coverage gap; ERS-1/2/4 cover luxury hotel explicitly.

### KI-009: Finance scenario lacks ERS-1 dedicated case
- **Symptom:** ERS-1 has no finance-specific live parity scenario.
- **Impact:** Finance ranking dedupe covered indirectly via ERS-2/3/4.

### KI-010: API auth is cookie-based only
- **Symptom:** Bearer token in `Authorization` header returns 401 on protected routes; cookie session required.
- **Impact:** Expected for Next.js SSR; programmatic API clients must use cookie jar or service role on server.

---

## P2 — Build warnings

### KI-011: Static generation cookie warnings
- **Symptom:** `next build` logs dynamic-server errors for portal/settings routes using `cookies`.
- **Impact:** Expected for authenticated routes; routes correctly marked `ƒ` (dynamic).

---

## Previously documented (still open)

| ID | Issue | Source |
|----|-------|--------|
| KI-012 | Manual UAT checklist (68 cases) not executed by QA | `docs/UAT_EXECUTION_REPORT.md` |
| KI-013 | Dedicated production Supabase project not provisioned | `docs/infrastructure/ENVIRONMENT_MATRIX.md` |
| KI-014 | Sentry/monitoring not confirmed live on staging | Phase 0.2 checklist |

---

## Resolved in this validation run

| Issue | Resolution |
|-------|------------|
| Runtime AI conversation navigation crash | **Fixed** — `runtime-verify-ai-workspace.mjs` now 10/10 PASS |
| ERS-2 TLS failure without bypass | **Workaround documented** — passes with TLS bypass |
