# Release 2.0 Phase 1 — Development Soak Plan

**Status:** Ready to execute (Phase 1 **code complete**)  
**Branch:** `feature/release-2-0-lifecycle`  
**Prerequisite:** Merge to `develop` → Dev deploy (`dev.thinkwaymedia.com`) with Development Supabase `hsxrewjcbvmbkqdlzjhs`  
**Feature flag:** Prefer explicit soak cohort first; Dev surface may default ON — do **not** enable Production  
**Sign-off after soak:** [`PRODUCTION_READINESS_REVIEW.md`](./PRODUCTION_READINESS_REVIEW.md) (create only when exit criteria are all green)  
**Phase 2:** Do **not** start until Phase 1 is deployed and stable in Production

---

## Rollout discipline

1. Merge feature branch → `develop` (Dev auto-deploy).  
2. Confirm Ops Center: Development ↔ `hsxrewjcbvmbkqdlzjhs`.  
3. Soak with structured scenarios below (not ad-hoc clicking).  
4. Every area in the exit matrix must be **green** — no yellow.  
5. Only then draft Production readiness review and seek Production approval.

---

## Soak scenarios

### 1. Commercial (new convert)

| Step | Action | Pass criteria |
|---|---|---|
| 1.1 | Create new quotation | Draft saves |
| 1.2 | Approve quotation | Status `approved` |
| 1.3 | Convert to Campaign (UI dry-run → execute) | Preview accurate; Assignments created |
| 1.4 | Validate commercial snapshot | `campaign_commercial_snapshots` row; hash present |
| 1.5 | Validate accepted pin | `accepted_quotation_id` + version on header |
| 1.6 | Validate Assignments | Lines + deliverables; header `planning`; provenance set |

**Result:** ☐ Pass · ☐ Fail — notes: ________

---

### 2. Legacy backfill

| Step | Action | Pass criteria |
|---|---|---|
| 2.1 | Open existing pre-R2.0 campaign (quote linked, 0 lines) | Banner / Backfill available |
| 2.2 | Backfill Preview | Dry-run; no writes |
| 2.3 | Execute Backfill | Assignments created; audit logged |
| 2.4 | Verify Vendor IO | Existing VIO unchanged / still generatable |
| 2.5 | Verify Billing | Existing invoices unchanged; new flow eligible if applicable |
| 2.6 | Verify Payments | No breakage on vendor payment status / readiness |

**Result:** ☐ Pass · ☐ Fail — notes: ________

---

### 3. Media Planning (regression only — no refactor)

| Step | Action | Pass criteria |
|---|---|---|
| 3.1 | Open campaign Media Plan | Loads without error |
| 3.2 | Schedule functions | Calendar / views usable |
| 3.3 | References | No broken creator/deliverable links |
| 3.4 | Deliverables visible | Hierarchy / plan items render |

**Result:** ☐ Pass · ☐ Fail — notes: ________

---

### 4. Performance (regression)

| Step | Action | Pass criteria |
|---|---|---|
| 4.1 | Existing campaign publish path | Works as before |
| 4.2 | Metrics update | Still updates |
| 4.3 | URLs update | Still updates |

**Result:** ☐ Pass · ☐ Fail — notes: ________

---

### 5. Billing (critical end-to-end)

```text
Assignment → Vendor IO → Invoice → Payment
```

| Step | Action | Pass criteria |
|---|---|---|
| 5.1 | Assignment present | From convert or backfill |
| 5.2 | Generate Vendor IO | Same gates as pre-R2.0 |
| 5.3 | Generate invoice | Eligible; amounts from Assignment hierarchy |
| 5.4 | Payment path | Client collections / vendor payout unchanged vs Prod behaviour |
| 5.5 | Compare to Production behaviour | **No differences** in lifecycle rules |

**Result:** ☐ Pass · ☐ Fail — notes: ________

---

### 6. Revision / convert controls

| Step | Action | Pass criteria |
|---|---|---|
| 6.1 | Second conversion | Blocked (idempotent) |
| 6.2 | Dry-run | No data written |
| 6.3 | Snapshot | Immutable (no in-place update) |
| 6.4 | Accepted quotation | Remains pinned |
| 6.5 | Draft quotation convert | Rejected |

**Result:** ☐ Pass · ☐ Fail — notes: ________

---

## Exit criteria (all green required)

| Area | Status |
|---|---|
| Conversion | ☐ |
| Snapshot | ☐ |
| Assignment | ☐ |
| Billing | ☐ |
| Vendor IO | ☐ |
| Backfill | ☐ |
| Regression (Media Plan + Performance) | ☐ |
| Feature Flag | ☐ |
| Performance (ops) | ☐ |
| RLS | ☐ |

**No yellow items.**

---

## Soak log

| Date | Tester | Environment | Outcome | Notes |
|---|---|---|---|---|
| | | Dev | | |

---

## After soak

| Outcome | Next action |
|---|---|
| All green | Author `PRODUCTION_READINESS_REVIEW.md` (4 questions only) → seek Production approval |
| Any red | Fix on `feature/*` or hotfix from `develop`; re-soak failed areas |
| Infra-only auth issues | Track under `docs/infrastructure/BACKLOG_DEV_SCHEMA_VALIDATION_CREDENTIALS.md` — do not block product soak if app paths work |

---

## Explicitly deferred

| Phase | Scope |
|---|---|
| **Phase 2** (after Prod stable) | Media Plan ownership; Original/Current/Actual; Assignment locking after Published; Planned vs Actual; Performance enrichment |
| **Phase 3** | Commercial Revision / Difference Engine; Reporting redesign |
