# Risk Report — Thinkway Platform

**Release:** 1.0 Phase 0.1 Security Foundation  
**Date:** Jul 2026

---

## Risk register

| ID | Risk | Severity | Status | Owner |
|----|------|----------|--------|-------|
| ESC-01 | Profile `role_id` self-escalation | **Critical** | ✅ Fixed | DBA |
| MW-01 | API routes returned 302 instead of 401 | **High** | ✅ Fixed | Dev |
| MW-02 | Cron routes blocked by session middleware | **High** | ✅ Fixed | Dev |
| API-01 | Enrich API no permission check | **High** | ✅ Fixed (prior) | Dev |
| API-02 | Report/export routes auth-only | **High** | ✅ Fixed | Dev |
| API-03 | Operations/campaigns routes no permission | **Medium** | ✅ Fixed | Dev |
| UP-01 | Public IO storage buckets | **High** | ⚠️ Migration exists; prod verify pending | Ops |
| INFRA-01 | Dev+prod same Supabase project | **High** | ❌ Open | Ops |
| MON-01 | No Sentry/error monitoring | **Medium** | ❌ Open | Ops |
| MFA-01 | No MFA for admin/finance | **Medium** | ❌ Open | Ops |
| SA-01 | Server actions auth-only (no permission) | **Medium** | ⚠️ Partial | Dev |
| RLS-01 | `business_function` not enforced | **Low** | ❌ Open | Dev |
| DOS-01 | PDF routes resource exhaustion | **Medium** | ⚠️ maxDuration set; no rate limit | Dev |

---

## Remaining P0 issues

| # | Issue | Blocker for internal prod? | Action |
|---|-------|---------------------------|--------|
| 1 | **Production Supabase project separation** (INFRA-01) | Yes — data isolation | Create dedicated prod project |
| 2 | **IO bucket public flag verification** (UP-01) | Yes — document leakage | Run storage audit on prod |
| 3 | **Apply migration `20260711010000`** on target DB | Yes — audit policy | Run supabase db push |

**Note:** All code-level P0 API/auth gaps from Phase 0.1 are resolved. Remaining P0 items are infrastructure/ops.

---

## Remaining P1 issues

| # | Issue | Target |
|---|-------|--------|
| 1 | Extend `requirePermission()` to all write server actions | Phase B |
| 2 | Rate limiting on PDF/export endpoints | Phase B |
| 3 | Enable Sentry + uptime monitoring | Week 1 post-deploy |
| 4 | MFA policy for admin/finance roles | Week 2 post-deploy |
| 5 | UAT security test execution | Before sign-off |
| 6 | Backup restore drill | Within 30 days of prod |

---

## Threat model summary

| Threat | Mitigation | Residual risk |
|--------|------------|---------------|
| Unauthenticated API access | Middleware + route checks | Low |
| Horizontal privilege escalation (client A → B) | RLS `can_access_client()` | Low |
| Vertical privilege escalation (viewer → admin) | ESC-01 trigger + RLS | Low |
| Data exfil via export endpoints | Permission + RLS + audit | Medium (no rate limit) |
| Storage URL guessing | Private buckets + signed URLs | Medium (prod verify) |
| Cron endpoint abuse | CRON_SECRET bearer | Low (if secret rotated) |

---

## Accepted risks (pilot)

| Risk | Rationale | Review date |
|------|-----------|-------------|
| Auth-only server actions with RLS fallback | RLS verified; weaker UX on denial | Phase B |
| 8 roles vs reference 6 | Operational mapping documented | Q3 2026 |
| No API rate limiting | Internal users only for pilot | Phase B |

---

## Cross-references

- `docs/GO_LIVE_READINESS.md` — prior assessment
- `docs/security/SECURITY_READINESS_REPORT.md` — score update
- `docs/PHASE_A_SECURITY_SIGNOFF.md` — prior signoff
