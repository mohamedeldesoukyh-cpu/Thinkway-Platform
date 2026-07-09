# Security Matrix — Thinkway Platform

**Release:** 1.0 Phase 0.1 Security Foundation  
**Date:** Jul 2026  
**Scope:** Authentication, authorization, RLS, storage, audit logging

---

## Executive summary

| Domain | Status | Notes |
|--------|--------|-------|
| Authentication | ✅ Improved | Middleware returns JSON 401 for `/api/*`; cron uses `CRON_SECRET` |
| Authorization (API) | ✅ Improved | All 37 API routes audited; permission checks on write/export routes |
| RBAC | ⚠️ Partial | 8 DB roles mapped; product reference roles approximated |
| Workspace isolation | ✅ Strong | `can_access_client()`, `can_access_campaign_header()` in RLS |
| RLS | ✅ Strong | 80+ tables with policies; FORCE RLS on financial tables |
| Storage | ⚠️ Partial | Private buckets for legal docs; IO buckets need prod verification |
| Audit logging | ✅ Foundation | `audit_logs` + `logAuditEvent()` wired to key operations |
| Profile escalation | ✅ Fixed | `guard_profile_privileged_columns` trigger (ESC-01) |

**Security readiness score:** 72/100 → **78/100** (see `SECURITY_READINESS_REPORT.md`)

---

## 1. Authentication

### Session handling

| Layer | Mechanism | Expired session |
|-------|-----------|-----------------|
| Middleware (`lib/supabase/middleware.ts`) | `supabase.auth.getUser()` | Page routes → redirect `/login`; API → JSON 401 |
| API routes | `requireApiPermission()` / `getUser()` | JSON 401/403 |
| Cron routes | `Authorization: Bearer ${CRON_SECRET}` | JSON 401 |
| Public routes | Allowlist in `lib/auth/routes.ts` | N/A |

### Public endpoints

| Path | Purpose | Risk |
|------|---------|------|
| `/login`, `/auth/*` | Auth flows | Low |
| `/io-approval/*` | Token-based IO approval | Medium — hashed tokens, single-use |
| `/api/build-info` | Deploy probe | Low — info disclosure (git SHA) |

### Phase 0.1 fixes

- **MW-01:** Unauthenticated `/api/*` now returns `{ error: "Unauthorized" }` with HTTP 401 (was 302 redirect)
- **MW-02:** `/api/cron/*` bypasses session when `CRON_SECRET` bearer token valid (was blocked by middleware)

---

## 2. Authorization model

### Enforcement layers

```
Request → Middleware (session) → API requirePermission() → RLS (can_access_*)
```

| Layer | Responsibility |
|-------|----------------|
| Middleware | Ensures authenticated session (except public/cron) |
| `requirePermission()` | App-layer permission slug check + admin bypass |
| RLS | Row-level workspace scoping; final data boundary |

### Privileged bypass roles

`super_admin` and `admin` bypass permission slug checks in `requirePermission()` (`lib/auth/permissions.ts`).

---

## 3. RBAC role mapping (product → codebase)

| Product role | DB slug | Primary permissions |
|--------------|---------|---------------------|
| Super Admin | `super_admin` | All (bypass) |
| Agency Admin | `admin` | All operational (bypass) |
| Campaign Manager | `account_manager` | clients/campaigns/influencers write |
| Finance | `finance` | invoices/payments/analytics/audit read |
| Creator Manager | `operations` | campaigns/influencers/discovery write |
| Client | `client_user` | client_portal.* scoped via `client_users` |
| Viewer | `viewer` | Read-only clients/campaigns/analytics |

**Gap:** No literal `director`, `manager`, `data_entry` roles — mapped via `account_manager` / `operations` / `viewer`.

---

## 4. Workspace isolation

### Scoping functions

| Function | Scope |
|----------|-------|
| `can_access_client(uuid)` | Admin OR internal + permission + `client_users` membership |
| `can_access_campaign_header(uuid)` | Admin OR account manager/creator OR client portal member |
| `can_access_influencer(uuid)` | Admin OR internal + permission + assignment linkage |
| `is_internal_user()` | Non-portal internal staff |
| `is_admin()` | `super_admin` or `admin` role |

### Agency / group isolation

Groups and agencies scoped via `group_id` column filters and RLS on `groups`, `brands`, `campaign_headers`. Cross-agency access requires admin role.

---

## 5. Storage security

| Bucket | Visibility | Policy |
|--------|------------|--------|
| `client-documents` | Private | `can_access_client()` + `clients.read/write` |
| `influencer-documents` | Private | `can_access_influencer()` + `influencers.read/write` |
| `creator-imports` | Private | `discovery.read/write`; immutable (no UPDATE/DELETE) |
| `vendor-io-documents` | Private (migration 20260629020000) | Signed URL serving via API |
| `client-io-documents` | Private (migration 20260629020000) | Signed URL serving via API |
| `campaign-publication-screenshots` | Private | Campaign-scoped RLS |

**P1 remaining:** Confirm prod bucket `public` flag disabled for all IO/document buckets.

---

## 6. Audit logging

| Component | Location |
|-----------|----------|
| Table | `public.audit_logs` (schema.sql) |
| Helper | `lib/audit/log-audit-event.ts` |
| Migration hardening | `20260711010000_audit_logs_security_foundation.sql` |

### Wired events (Phase 0.1)

| Event | Action enum | Location |
|-------|-------------|----------|
| Campaign cancel | `delete` | `features/campaigns/actions/cancel-campaign.ts` |
| Campaign reopen | `update` | `features/campaigns/actions/cancel-campaign.ts` |
| Role change | `update` | `features/settings/actions.ts` |
| Shortlist export | `export` | `app/api/shortlists/[id]/export/route.ts` |
| Quotation export | `export` | `app/api/quotations/[id]/export/route.ts` |
| Client document upload | `create` | `app/api/clients/[clientId]/documents/route.ts` |
| P&L report export | `export` | `app/api/reports/pnl/document/route.ts` |

DB triggers also write to `audit_logs` on configured tables via `write_audit_log()`.

---

## 7. Cross-references

- `PERMISSION_MATRIX.md` — permission slugs by role
- `RLS_MATRIX.md` — table-level RLS coverage
- `API_AUDIT.md` — route-by-route auth/permission matrix
- `RISK_REPORT.md` — open risks and P0 register
- `SECURITY_READINESS_REPORT.md` — go-live readiness score
