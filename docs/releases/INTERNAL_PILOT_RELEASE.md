# Thinkway — Internal Pilot Release

**Milestone:** Internal Pilot  
**Date:** 2026-07-27  
**Branch:** `develop`  
**Prior closed work:** Creator CRM Phases 1 → 2A → 2B · Identity · Discovery · Creator DNA · Campaign Intelligence · AI Discovery · Production Readiness sprint  

**Constraints for this milestone packaging:** no Phase 2C, no CRM writers enablement, no Discovery behaviour changes, no new product features.

**Verification:** [INTERNAL_PILOT_VERIFICATION_REPORT.md](./INTERNAL_PILOT_VERIFICATION_REPORT.md)

---

## Executive Summary

Thinkway is packaged for an **internal staff pilot**: core operations (hierarchy, campaigns, Discovery, DNA, intelligence, quotations) are in place; Commercial CRM tables and Phase 2B activation wiring exist but remain **dormant** behind `CREATOR_CRM_WRITERS_ENABLED` (default **OFF**). The Production Readiness sprint closed critical reliability/security gaps without expanding product scope.

**Architecture invariant:**

```
Identity → Discovery → Commercial CRM (optional, writers OFF)
```

---

## Major Features Delivered

| Area | Status |
|---|---|
| Group → Legal Entity → Brand → Campaign Header → Line | Operational |
| Discovery (Browse, Search, AI, Shortlists, Import) | Operational; CRM-isolated |
| Creator DNA | Operational |
| Campaign Intelligence / Studio surfaces | Operational |
| AI Discovery | Operational |
| Creator CRM Phase 1 (schema + ensure API) | Shipped; writers OFF |
| Creator CRM Phase 2A (identity rename, DNA staging, helpers) | Shipped; writers OFF |
| Creator CRM Phase 2B (assignment + quote→campaign wiring) | Shipped; writers OFF; Dev soak passed |
| Production Readiness hardenings | Shipped (see below) |

---

## Architecture Status

| Layer | Pilot posture |
|---|---|
| Identity | Source of truth for creators |
| Discovery | Independent research surface; does not create Commercial CRM |
| Commercial CRM | Optional; persistence gated OFF |
| Finance / RLS | Least-privilege paths from prior security work remain in force |

Deep refs: `docs/architecture/CREATOR_CRM_FINAL_ARCHITECTURE.md`, `docs/DISCOVERY_ARCHITECTURE.md`, `docs/production-readiness/ARCHITECTURE_OVERVIEW.md`.

---

## Production Readiness Summary

| Pillar | Pilot verdict |
|---|---|
| Security | Conditional GO (internal) — see High Priority |
| Database | GO (additive posture) |
| Queues | Improved (producer Redis fix) |
| Performance | Conditional GO (budgets exist; RUM incomplete) |
| Observability | Improved schema; Sentry still deferred |
| CRM | GO dormant (writers OFF) |
| Docs | Canonical pack under `docs/production-readiness/` |

Full report: `docs/production-readiness/PRODUCTION_READINESS_REPORT.md` — **Conditional GO (internal pilot)**.

---

## Security Improvements (stabilisation)

- Portal `external_link` validated on write; render via `SafeExternalLink`
- Quotation export requires `discovery.read` + audit
- Entity uploads reject empty / non-allowlisted MIME
- CI adds auth-p1 + CRM + BullMQ + MIME gates

---

## Performance Improvements

- No Discovery UX/ranking changes
- Queue producer fix prevents silent “queued forever” stalls (class of latency incidents)
- Existing performance governance docs remain authoritative

---

## Reliability Improvements

- BullMQ producers (metrics, creator-import, acquisition cancel) use `createBullMqQueueConnection`
- Regression test prevents `{ connection: { url } }` localhost fallback
- Structured log fields extended for creator/job correlation (opt-in adoption)

---

## Documentation Added

| Path | Role |
|---|---|
| `docs/production-readiness/*` | Stabilisation pack + Go/No-Go |
| `docs/architecture/CREATOR_CRM_PHASE2B_DEV_SOAK_REPORT.md` | Phase 2B soak |
| `docs/releases/INTERNAL_PILOT_RELEASE.md` | This document |
| `docs/releases/INTERNAL_PILOT_VERIFICATION_REPORT.md` | Finalisation verification |
| Feature Flag Guide | `docs/production-readiness/FEATURE_FLAG_GUIDE.md` |

Phase sign-offs: `CREATOR_CRM_PHASE1_SIGN_OFF.md`, `CREATOR_CRM_PHASE2A_SIGN_OFF.md`, `CREATOR_CRM_PHASE2B_SIGN_OFF.md`.

---

## Remaining High-Priority Items

1. Shared rate limiting (Redis/Upstash) for multi-instance  
2. Replace `xlsx` (CVE surface)  
3. Install/wire Sentry  
4. Production PITR decision  
5. Dual-env secret matrix verification on every promote  
6. Optional CI service-role least-privilege for browse measure  

---

## Deferred Work (Phase 2C+)

Do **not** start without explicit approval:

- Vendor IO / Manual Convert / Portal CRM activation  
- Commercial list filter UX  
- CRM backfill  
- Production writers enablement  
- Any Discovery → CRM coupling  

---

## Known Limitations

- CRM writers OFF → no Commercial Creator persistence in Production  
- Interactive Discovery E2E on Preview may be SSO-constrained  
- In-memory rate limits are per-instance  
- Sentry SDK not installed  
- Uneven BullMQ DLQ / retry policy across queues  
- Route `error.tsx` coverage incomplete on some workspaces  

---

## Internal Pilot Scope

**In scope**

- Internal staff use of Discovery, campaigns, quotations, DNA, intelligence  
- Validation that CRM remains dormant (writers unset)  
- Ops monitoring via health / Ops Center / worker heartbeat  

**Out of scope**

- Enabling `CREATOR_CRM_WRITERS_ENABLED` on any shared environment without a timed soak ticket  
- External portal scale as a GO criterion (see readiness High items)  
- Phase 2C+ commercial expansion  

**Environment defaults**

| Env | CRM writers |
|---|---|
| Production | **OFF** (unset) |
| Preview / Development | **OFF** (unset; soak-only temporary enable then remove) |
| Local | **OFF** (`.env.example` documents false) |

---

## Recommended Next Milestone

1. **Internal Pilot operations** — staff smoke, monitor queues/errors, keep writers OFF.  
2. Close High Priority items from Production Readiness (rate limits, Sentry, `xlsx`, PITR).  
3. Only then: product review for **Phase 2C** scope (separate approval).  

Do not treat Internal Pilot as approval to enable Commercial CRM writers or start Phase 2C.
