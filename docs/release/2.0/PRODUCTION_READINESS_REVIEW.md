# Release 2.0 Phase 1 — Production Readiness Review

**Date:** 2026-07-28  
**Scope:** Phase 1 only (unified Quote → Assignment conversion + commercial snapshot + backfill wizard)  
**Development soak:** [DEVELOPMENT_SOAK_PLAN.md](./DEVELOPMENT_SOAK_PLAN.md) — **exit matrix 100% green**  
**Production deploy:** Not executed — requires **explicit approval** after this review  
**Phase 2:** Blocked until Phase 1 is Production-stable

---

## 1. What changed?

Release 2.0 Phase 1 replaces fragmented Quote → Campaign conversion with a single Assignment-based path:

- Convert only from **approved** quotations into Campaign Assignments (`campaign_lines` + deliverables).
- Persist a **commercial snapshot** and **accepted quotation pin** on the campaign header.
- Record **provenance** on each Assignment (source quotation / item).
- Keep convert **idempotent** and support **dry-run** preview before write.
- Provide an opt-in **Backfill** wizard (detect → dry-run → execute) for legacy quote-linked campaigns with zero Assignments.
- Gate the new behaviour behind **`RELEASE_2_0_ASSIGNMENT_CONVERT`** (OFF by default in code).

Billing, Vendor IO, Media Plan, and Performance lifecycles were **not** redesigned in Phase 1.

---

## 2. What was validated?

On Development (`dev.thinkwaymedia.com` + Supabase `hsxrewjcbvmbkqdlzjhs`):

| Area | Evidence |
|---|---|
| Conversion | QT-2026-0005 → TW-2026-0002 (engine + UI dry-run / idempotent warning) |
| Snapshot + pin | Commercial snapshot row + hash; accepted quotation pinned |
| Assignments | Lines + deliverables + provenance; header `planning` |
| Billing E2E | Assignment → VIO-2026-0006 → INV-2026-00002 → PAY-1 |
| Vendor IO | UI generate works; no auto-VIO on convert/backfill |
| Backfill | Isolated fixtures QT-2026-0019 → TW-2026-0003: detect / dry-run / execute / idempotent; no side effects on TW-0001/TW-0002 |
| Media Plan / Performance | Load regression OK (no Phase 1 refactor) |
| Feature flag | OFF by default; Preview(`develop`) explicit ON for soak only |
| RLS | Anonymous insert into commercial snapshots denied |

Automated pre-gates (`test:release-2-0`, CRM Phase 2B, TypeScript) passed. No critical Conversion / Billing / Vendor IO / Assignment / RLS / data-integrity regressions found in soak.

---

## 3. What remains behind feature flags?

| Flag | Production default | Notes |
|---|---|---|
| `RELEASE_2_0_ASSIGNMENT_CONVERT` | **OFF** (unset / false) | Also `NEXT_PUBLIC_RELEASE_2_0_ASSIGNMENT_CONVERT` for UI |
| Backfill wizard | Behind the same flag | Never automatic; user-driven detect → dry-run → execute |

Phase 2+ work (Media Plan ownership hard guards, Performance refactor, Commercial Revision, Reporting redesign) remains **out of scope** and unflagged as “not started.”

---

## 4. Why is it safe to deploy?

- Behaviour is **additive and flagged**: Production stays on the existing path until the flag is explicitly enabled after deploy approval.
- Core invariants were soak-proven: approved-only convert, snapshot + pin, provenance, idempotency, no auto Billing/Vendor IO side effects, Backfill opt-in only.
- Billing → Vendor IO → Invoice → Payment still works on Assignment hierarchy after convert.
- Legacy campaigns are not silently rewritten; Backfill requires detection and operator action.
- Development soak exit matrix is **fully green** with no yellow carry-over items.

**Recommendation:** **Go for Production Release 2.0 Phase 1**, contingent on:

1. Explicit Production deploy + migration approval (Development-first policy).  
2. Production feature flag left **OFF** until post-deploy smoke, then enabled intentionally.  
3. No Phase 2 work in the same release.

---

## Decision

| Item | Status |
|---|---|
| Development soak | ✅ Complete |
| Production readiness review | ✅ This document |
| Production deployment | ⏸ Awaiting explicit approval |
| Final recommendation | **Go** (Phase 1, flag-gated) |
