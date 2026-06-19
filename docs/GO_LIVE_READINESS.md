# Go-Live Readiness Summary — Thinkway Platform

**Program:** THINKWAY PRODUCTION GO-LIVE (7 phases)  
**Assessment date:** Jun 2026  
**Branch reviewed:** `feature/campaign-client-bo-attachment` (codebase state)  
**Assessor:** Documentation review against live codebase — no code changes in this program.

---

## Phase summary

| Phase | Document | Status | Summary |
|-------|----------|--------|---------|
| 1 — Security | `docs/SECURITY_AUDIT.md` | ⚠️ **Gaps** | Strong RLS foundation; critical profile escalation risk; public IO buckets; API auth gaps |
| 2 — Permissions | `docs/ROLE_MATRIX.md` | ⚠️ **Partial** | 8 DB roles vs reference 6; no director/manager/data_entry; RLS is primary enforcement |
| 3 — Backup | `docs/BACKUP_AND_RECOVERY.md` | 📋 **Strategy only** | Supabase daily backup + 30-day retention documented; storage mirror not automated |
| 4 — Deployment | `docs/DEPLOYMENT_GUIDE.md` | ⚠️ **Partial** | Vercel + Supabase checklist ready; prod still references thinkway-dev project ref |
| 5 — Monitoring | `docs/MONITORING_SETUP.md` | ❌ **Not implemented** | No Sentry; build-info probe only; alerts documented as recommendations |
| 6 — UAT | `docs/UAT_CHECKLIST.md` | 📋 **Ready to execute** | Structured checklist created; execution pending |
| 7 — Readiness | This document | — | See rating below |

---

## 1. Security readiness

### Strengths

- Comprehensive RLS on core entities (`supabase/policies.sql`, 73 migrations)
- Invoice RLS hardening after production audit (`20260531620000_billing_invoice_rls_hardening.sql`)
- FORCE RLS on financial and IO tables
- Service role **not** used in Next.js runtime (scripts/worker only)
- Private buckets for client/influencer legal documents with path-scoped policies
- Middleware auth with `getUser()` validation; public route allowlist is minimal
- IO approval tokens hashed; single-use on approve

### Open risks

| Risk | Severity | Phase A action |
|------|----------|----------------|
| Profile `role_id` self-escalation via RLS | **Critical** | DB trigger before go-live |
| Public `vendor-io-documents` / `client-io-documents` buckets | **High** | Make private; signed URL serving |
| `/api/vendors/platform-accounts/enrich` no permission check | **High** | Add auth + `influencers.write` |
| Production on thinkway-dev Supabase ref | **High** | Dedicated prod project |
| No `.env.example` | Medium | Document all env vars |
| No MFA policy | Medium | Enable for admin/finance |

**Security phase verdict:** Not complete until Phase A remediations addressed.

---

## 2. Permissions readiness

### Strengths

- Granular permission slugs with seed + migration extensions
- Finance correctly lacks `campaigns.write`
- Settings UI permissions matrix (`features/settings/components/permissions-matrix.tsx`)
- Client/campaign scoping via `can_access_client()` / `can_access_campaign_header()`

### Gaps vs product reference

- No `Director`, `Manager`, or `Data Entry` roles — operational mapping uses `operations`, `account_manager`, `viewer`
- `business_function` (Sales/OPS) is not authorization-enforced
- Many server actions check auth only; rely on RLS (acceptable if RLS verified, but weaker UX)
- Reference "10 standard reports" not fully built — analytics partial

**Permissions phase verdict:** Acceptable for pilot with documented role mapping; not aligned to reference §6 literally.

---

## 3. Backup & recovery readiness

### Documented

- 24-hour RTO target with tiered recovery
- Daily DB backup, 30-day retention recommendation
- Storage bucket inventory and regeneration fallback for IO PDFs
- Quarterly restore drill procedure

### Not yet done

- Production Supabase backup policy confirmation
- Off-site storage mirror automation
- Completed restore drill log

**Backup phase verdict:** Strategy complete; **operational proof pending**.

---

## 4. Deployment readiness

### Ready

- `vercel.json` function limits for PDF routes
- `middleware.ts` session handling
- `/api/build-info` deploy verification (`lib/deploy/build-info.ts`)
- Existing runbooks: `docs/DEPLOYMENT.md`, `docs/PRODUCTION_MANDATORY_DEPLOY.md`
- Clean lifecycle architecture enforced (no bootstrap lines)

### Pending

- Custom domain `app.thinkway.com` / `platform.thinkway.com` (documented, not in repo config)
- Security headers in `vercel.json`
- Production Supabase project separation from `hsxrewjcbvmbkqdlzjhs`
- All `202606*` migrations applied and verified on target project

**Deployment phase verdict:** Deploy process understood; **production infra split pending**.

---

## 5. Monitoring readiness

### Current

- Dev-only debug logging
- Manual build-info checks
- Supabase/Vercel dashboards available but not configured with alerts

### Required before steady-state production

- Sentry (`@sentry/nextjs`) — not in codebase
- Uptime synthetic on `/api/build-info`
- Alerts: auth failures, API 5xx, PDF timeouts, invoice/VIO failures

**Monitoring phase verdict:** **Not ready** — recommendations documented in `docs/MONITORING_SETUP.md`.

---

## 6. UAT readiness

- Checklist created: `docs/UAT_CHECKLIST.md`
- Covers: clients, campaigns, VIO, client IO, billing, finance approvals, reports
- Critical path minimum defined (13 tests)
- **Execution status:** Not run as part of this documentation program

**UAT phase verdict:** Checklist ready; **sign-off pending**.

---

## Open risks register (consolidated)

| # | Risk | Owner | Target date |
|---|------|-------|-------------|
| 1 | Profile role escalation (ESC-01) | Dev/DBA | Before any prod users |
| 2 | Public IO storage buckets (UP-01) | Dev/Ops | Before finance go-live |
| 3 | Enrich API unauthorized use (API-01) | Dev | Before prod |
| 4 | Single Supabase project for dev+prod | Ops | Before prod |
| 5 | No error monitoring | Ops/Dev | Week 1 post-deploy |
| 6 | UAT not executed | QA | Before sign-off |
| 7 | Backup drill not performed | Ops | Within 30 days of prod |
| 8 | Role matrix mismatch with reference | Product | Accept or implement new roles |

---

## Go-live recommendation

### Final rating: **CONDITIONALLY READY**

Thinkway is **not** rated **READY FOR PRODUCTION** for unrestricted enterprise launch. It is **CONDITIONALLY READY** for a **controlled pilot** (internal finance + operations team, limited clients/campaigns) **after Phase A security remediations** are complete.

### Conditions for pilot start

1. ✅ Fix profile role escalation (Critical)
2. ✅ Secure IO document buckets (High)
3. ✅ Add API permission gate on enrich route (High)
4. ✅ Confirm invoice RLS migration applied
5. ✅ Execute UAT critical path (minimum 13 tests) with sign-off
6. ⚠️ Uptime monitoring on build-info (minimum viable monitoring)

### Conditions for full production (enterprise)

All pilot conditions, plus:

7. Dedicated production Supabase project with 30-day backups + completed restore drill
8. Sentry integrated with billing/IO alert rules
9. Custom domain + security headers live
10. Full UAT checklist pass (all sections)
11. MFA enabled for admin/finance
12. `.env.example` and secrets vault export

### NOT READY if

- Phase A security items remain open
- UAT critical path has unresolved failures
- Migrations not aligned between local and remote

---

## Rating matrix

| Rating | Criteria | Current |
|--------|----------|---------|
| **NOT READY** | Critical security open + no UAT | — |
| **CONDITIONALLY READY** | Core ops functional; known gaps with remediation plan | **← Current** |
| **READY FOR PRODUCTION** | All phases green; UAT signed off; monitoring live | Not yet |

---

## Document index

| Document | Path |
|----------|------|
| Security Audit | `docs/SECURITY_AUDIT.md` |
| Role Matrix | `docs/ROLE_MATRIX.md` |
| Backup & Recovery | `docs/BACKUP_AND_RECOVERY.md` |
| Deployment Guide | `docs/DEPLOYMENT_GUIDE.md` |
| Monitoring Setup | `docs/MONITORING_SETUP.md` |
| UAT Checklist | `docs/UAT_CHECKLIST.md` |
| Go-Live Readiness | `docs/GO_LIVE_READINESS.md` |

### Supporting existing docs

- `docs/THINKWAY_SYSTEM_REFERENCE.md` — product spec
- `docs/ARCHITECTURE_ALIGNMENT.md` — gap analysis
- `docs/DEPLOYMENT.md` — quick deploy checklist
- `docs/PRODUCTION_MANDATORY_DEPLOY.md` — lifecycle deploy steps
- `docs/CLEAN_LIFECYCLE_VALIDATION.md` — lifecycle SQL validation

---

## Next actions (recommended order)

1. **Dev:** Remediate ESC-01, UP-01, API-01 (see `SECURITY_AUDIT.md` Phase A)
2. **Ops:** Create production Supabase project; configure backups
3. **QA:** Run `UAT_CHECKLIST.md` on staging; log defects
4. **Ops:** Uptime monitor + Supabase backup alerts
5. **Dev:** Sentry Phase 1 integration
6. **Product/Finance:** Sign off role mapping or schedule director/manager roles
7. **All:** Re-run this readiness assessment after remediations → target **READY FOR PRODUCTION**

---

*This assessment reflects codebase review as of Jun 2026. Re-assess after each remediation sprint.*
