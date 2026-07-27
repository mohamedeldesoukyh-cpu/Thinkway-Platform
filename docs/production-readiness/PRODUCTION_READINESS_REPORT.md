# Thinkway — Production Readiness Report

**Sprint:** Production Readiness & Enterprise Stabilisation  
**Date:** 2026-07-27  
**Branch baseline:** `develop` (post Creator CRM Phase 2B soak)  
**Scope:** Audit + safe hardenings only  
**Out of scope:** Phase 2C+ CRM, feature expansion, UI redesign, Production flag enablement  

**Index:** [README.md](./README.md) · Changes: [CHANGELOG_STABILISATION.md](./CHANGELOG_STABILISATION.md)

---

## 1. Executive Summary

Thinkway’s core product architecture (Identity → Discovery → optional Commercial CRM) is sound after Phases 1–2B. Security, RLS, and Discovery isolation are strong for an **internal operational pilot**. This sprint closed several production-safety gaps (BullMQ producer Redis mismatch, portal external-link XSS surface, quotation export authz, empty MIME upload bypass) without changing product behaviour or enabling CRM writers.

| Pillar | Verdict |
|---|---|
| Security | **Conditional GO** for internal pilot; portal XSS + rate-limit + `xlsx` residuals remain for external scale |
| Database | **GO** with additive-index / type-regen follow-ups |
| Performance | **Conditional GO** — budgets/docs exist; live RUM/worker SLOs incomplete |
| Queues | **Improved** — critical producer bug fixed; DLQ/retry unevenness remains |
| Discovery | **GO** — isolated from CRM; writers OFF |
| CRM | **GO (dormant)** — writers OFF; Phase 2B soak approved; no 2C |
| UX | **Acceptable** — inconsistent `error.tsx` coverage (suggestions only) |
| Code quality | **Good** — low TODO density; CI gates expanded |
| Documentation | **Complete for this sprint** (canonical set under `docs/production-readiness/`) |

### Go / No-Go

**Recommendation: Conditional GO (internal Production / staff pilot)**  

**No-Go for broad external portal scale** until High residuals in §12 are closed (shared rate limits, `xlsx` replacement, Sentry wiring, PITR decision).

CRM writers must remain **OFF** on Production.

---

## 2. Security Assessment

### Strengths

- JWT via `getUser()`; middleware session refresh; open-redirect hardening
- Fail-closed API classification; portal ↔ internal isolation
- Finance + creator-intelligence RLS least-privilege + FORCE RLS
- Service-role factory is `server-only` with guard tests
- CSRF + security headers on edge proxy; invite/IO token hashing; privileged MFA scaffolding

### Implemented this sprint (safe)

1. Portal `external_link` write validation + `SafeExternalLink` render  
2. Quotation export `discovery.read` + audit log  
3. Entity upload empty-MIME rejection  
4. CI: `test:auth-p1` on validate workflow  

### Residuals

| Severity | Item | Action |
|---|---|---|
| High | In-memory rate limiter (multi-instance bypass) | Architectural: Redis/Upstash |
| High | `xlsx@0.18.5` CVE surface | Product: replace parser |
| High | CI may still inject service-role for browse measure | Ops: least-privilege secret |
| Medium | Non-HttpOnly auth cookies + CSP unsafe-inline/eval | Architecture decision |
| Medium | Uneven Zod on some AI/lifecycle routes | Incremental |
| Medium | Sentry not installed | Ops + package decision |
| Low | Cron secret compare timing / shared helper | Follow-up |

---

## 3. Database Assessment

- ~185 migrations; recent CRM + RLS + list RPC indexes are high quality  
- CRM: PK/FK, unique activation source, append-only events, RLS  
- **Do not** run destructive cleanups in Production without audit queries  

Gaps: regenerate `types/database.ts` for discovery control/coverage tables; refresh handover migration counts; prefer additive indexes with EXPLAIN on Dev.

---

## 4. Performance Assessment

Docs: `PERFORMANCE_GOVERNANCE.md`, `PERFORMANCE_ENGINEERING_STANDARDS.md`.

| Area | Notes |
|---|---|
| Discovery browse | Must stay RPC-first; legacy full-catalog fallback is a regression |
| Creator search client | Near soft budget (~72 KB) — watch |
| Dashboard CSS | Shared campaign/platform CSS across routes |
| CRM | Writers OFF → negligible Production cost; Dev soak assignment ~0.3–0.7s |
| RUM / SQL percentile pipelines | Defined, not fully continuous |

**Optimisations this sprint:** none that alter UX; queue connection fix prevents silent “queued forever” latency class.

---

## 5. Queue Assessment

**Critical fix shipped:** metrics, creator-import, and acquisition-cancel producers now use `createBullMqQueueConnection` (same class of bug previously fixed for discovery enqueue).

| Topic | Status |
|---|---|
| Retries | Metrics/import/enrichment: 3× exp; discovery/enterprise still retention-first |
| DLQ | Enrichment only |
| Stalled / stuck recovery | Import + enrichment boot recovery present |
| Redis reconnect | Worker ioredis `maxRetriesPerRequest: null`; env isolation guards exist |
| Tests | `npm run test:bullmq-connection` (+ CI) |

---

## 6. Discovery Assessment

| Check | Result |
|---|---|
| Browse / Search / AI / Shortlists / Import / DNA promote create CRM? | **No** (writers OFF + boundary tests) |
| Apify identity helper | Identity only (`ensureIdentityCreatorFromApifyData`) |
| Shortlist → campaign | Commercial handoff gated by writers |
| Automated suites | UI contract, shortlist, browse tier, import upsert, CRM boundary — pass |

Discovery remains independently operable with Commercial CRM disabled.

---

## 7. CRM Assessment

| Check | Result |
|---|---|
| Layers Identity → Discovery → Commercial | Preserved |
| Sole entry `ensureCommercialCreator` | Yes |
| Writers default OFF | Confirmed (`feature-flag.ts` + tests) |
| Phase 2B wiring | Assignment + quote→campaign only; dual-event |
| Idempotency | Profile PK + unique activation source; soak + unit tests |
| Rollback | Writers OFF no-ops; SQL rollback exists for tables |
| Production enablement | **None** — must stay unset |

**Phase 2C+ explicitly not started.**

---

## 8. UX Assessment

| Pattern | Status |
|---|---|
| Route `loading.tsx` | Broad coverage via `ThinkwayRouteLoading` |
| Empty states | Strong in Discovery design system |
| Soft-fail pages | Campaigns/list often `allSettled` + alert |
| `error.tsx` | Sparse on campaigns/groups/vendors |

**Suggestions (not implemented — avoid UI redesign):** add `error.tsx` using existing platform fallbacks on `/campaigns/[id]`, `/groups/[id]`, `/vendors/[id]`; keep Discovery empty-state language consistent.

---

## 9. Code Quality Assessment

- Low inline TODO/FIXME density; debt mostly in docs  
- Feature-based modules; CRM boundary tests enforce dependency direction  
- CI expanded for CRM / BullMQ / MIME / auth-p1  
- Dual loggers (`platform/logger` vs `observability/structured-logger`) — prefer observability path going forward  

---

## 10. Documentation Status

| Required | Status |
|---|---|
| Architecture Overview | ✅ `ARCHITECTURE_OVERVIEW.md` |
| Production Deployment Guide | ✅ `PRODUCTION_DEPLOYMENT_GUIDE.md` |
| Security Checklist | ✅ `SECURITY_CHECKLIST.md` |
| Feature Flag Guide | ✅ `FEATURE_FLAG_GUIDE.md` (**new canonical**) |
| Operations Runbook | ✅ `OPERATIONS_RUNBOOK.md` |
| Database Overview | ✅ `DATABASE_OVERVIEW.md` |
| Queue Architecture | ✅ `QUEUE_ARCHITECTURE.md` (**new canonical**) |
| Disaster Recovery | ✅ `DISASTER_RECOVERY.md` |
| Production Rollout Checklist | ✅ `PRODUCTION_ROLLOUT_CHECKLIST.md` |
| This report | ✅ |

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Accidental CRM writers ON in Production | Low | High | Flag guide + rollout checklist + env audit |
| Jobs enqueue to localhost Redis | Low after fix | High | Connection factory + CI regression |
| Portal XSS via legacy stored links | Low after fix | High | SafeExternalLink hides unsafe hrefs |
| Multi-instance auth brute-force | Medium | Medium | Shared rate limit project |
| Spreadsheet import CVE (`xlsx`) | Medium | High | Parser replacement project |
| PITR off on Production | Medium | High | Billing/ops decision |
| No Sentry | High | Medium | Install + DSN |
| Discovery browse legacy fallback | Low | High | Monitor Ops logs |

---

## 12. High Priority Issues

1. **Shared rate limiting** (Redis/Upstash) for auth/AI/export  
2. **Replace `xlsx`** with maintained parser  
3. **Install/wire Sentry** (`@sentry/nextjs` + `SENTRY_DSN`)  
4. **Verify Production env matrix** (Supabase + Redis + secrets) on every promote  
5. **Enable Production PITR** (or accept RPO and document)  
6. **Confirm CI service-role** for browse measure is least-privilege / optional-only  

---

## 13. Medium Priority Issues

1. Align discovery/enterprise job `attempts`/`backoff` with metrics/import  
2. Expand DLQ / failed-job alerting beyond enrichment  
3. Regenerate Supabase types for discovery control tables  
4. Global request-id middleware + broader structured log adoption (workers)  
5. Incremental Zod on remaining mutating AI routes  
6. CIP elevated `brand_id` re-check (`assertAccessibleBrandId`)  
7. Expand route-level `error.tsx` coverage  

---

## 14. Low Priority Improvements

1. Timing-safe cron secret compare + shared authorize helper  
2. Early `discovery.write` on import upload actions  
3. Remove orphan queue names from health lists if unused  
4. Refresh stale Jun-era checklist branch refs in older go-live docs  
5. Dual logger consolidation  

---

## 15. Recommended Production Checklist

See [PRODUCTION_ROLLOUT_CHECKLIST.md](./PRODUCTION_ROLLOUT_CHECKLIST.md) and [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md).

Minimum gate before Production traffic:

1. CI green including new CRM/BullMQ/MIME/auth steps  
2. Writers flag unset on Production  
3. Redis producer fix deployed to app **and** workers healthy  
4. Dual-env secrets verified  
5. Smoke Discovery + campaign + quotation export  
6. CRM event counts unchanged after smoke  

---

## 16. Go / No-Go Recommendation

### **Conditional GO — Internal Production / staff pilot**

Approved completed work (Phases 1–2B, Discovery, DNA, Campaign Intelligence, AI Discovery, Dev soaks) may remain deployed with:

- Commercial CRM **writers OFF**  
- Discovery operating independently  
- Stabilisation hardenings from this sprint merged  

### Conditions (must acknowledge)

1. Close or explicitly accept High items in §12 before **external portal scale**.  
2. Do **not** start Phase 2C until a separate approval.  
3. Do **not** enable `CREATOR_CRM_WRITERS_ENABLED` on Production.  
4. Ops verifies Redis/Supabase isolation and cron/ready secrets on Production.  
5. Prefer Sentry + shared rate limits as the next engineering tranche (still non-feature).

### **NO-GO** if any of the following are true

- CRM writers enabled on Production  
- App and worker Redis hosts diverge  
- Production migrations / RLS known broken  
- Unreviewed Phase 2C+ CRM code included in the release  

---

## Appendix A — Validation commands

```bash
npm run test:creator-crm-phase2b
npm run test:bullmq-connection
npm run test:storage-mime
npm run test:auth-p1
npm run test:discovery-ui-contract
npm run test:discovery-shortlist
```

## Appendix B — Architecture invariant

```
Identity
  ↓
Discovery
  ↓
Commercial CRM (optional — writers OFF)
```
