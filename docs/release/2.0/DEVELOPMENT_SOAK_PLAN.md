# Release 2.0 Phase 1 — Development Soak Plan

**Status:** In progress — automated gates green; **manual UI soak pending** Preview/Dev deploy  
**Branch / RC:** `feature/release-2-0-lifecycle` · [PR #2](https://github.com/mohamedeldesoukyh-cpu/Thinkway-Platform/pull/2)  
**Baseline:** RC PR is the implementation baseline (fix soak blockers only; no Phase 2)  
**Deploy path for UI soak:** Vercel Preview on the RC branch (preferred before merge) **or** merge → `develop` → `dev.thinkwaymedia.com`  
**Database:** Development Supabase `hsxrewjcbvmbkqdlzjhs` (migration already applied)  
**Feature flag:** Prefer explicit soak cohort first; Dev surface may default ON — do **not** enable Production  
**Sign-off after soak:** [`PRODUCTION_READINESS_REVIEW.md`](./PRODUCTION_READINESS_REVIEW.md) (create only when exit criteria are all green)  
**Phase 2:** Do **not** start until Phase 1 is deployed and stable in Production

---

## Automated pre-gates (must pass before marking exit matrix)

| Gate | Command / check | Status (2026-07-28) |
|---|---|---|
| R2.0 unit + CRM boundary | `npm run test:release-2-0` | ✅ 18/18 |
| Creator CRM Phase 2B | `npm run test:creator-crm-phase2b` | ✅ 20/20 |
| TypeScript (`tsc --noEmit`) | full project | ✅ |
| Dev schema — snapshot table | `campaign_commercial_snapshots` | ✅ |
| Dev schema — accepted pin | `accepted_quotation_id` / `_version` | ✅ |
| Dev schema — line provenance | `source_quotation_id` / `_item_id` | ✅ |
| Validate CI on PR #2 | GitHub Actions | ✅ pass (`4476e759`) |
| Vercel Preview build | Preview Ready | ✅ Ready — **Deployment Protection (Vercel SSO) blocks unattended soak** |

### Soak fixes applied (discovered during gate run)

1. CRM boundary allowlist — `convert-quotation-to-assignments.ts` (intentional Quote→Assignment CRM wiring).  
2. Backfill wizard + convert dialog — narrow `ActionResult` before reading `message` / `data` (Vercel TS failure).  
3. Legacy flag-off convert return shape + audit event `quotation.converted_to_assignments`.  
4. Added `npm run test:release-2-0` for soak regression.

---

## Rollout discipline

1. Keep RC green (CI + Preview).  
2. Execute structured scenarios below on Preview **or** Dev after merge.  
3. Confirm Ops Center: Development ↔ `hsxrewjcbvmbkqdlzjhs`.  
4. Every area in the exit matrix must be **green** — no yellow.  
5. Only then draft Production readiness review and seek Production approval.  
6. Merge to `develop` is allowed for Dev soak when Preview is insufficient; **do not** merge to `main` / Production without all-green soak + approval.

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
| 2026-07-28 | Agent | Local + Dev DB + CI/Preview | Partial | Automated pre-gates + CI + Preview green; Preview URL requires Vercel SSO — manual UI soak needs authenticated access (Preview SSO, local `.env`, or merge → `dev.thinkwaymedia.com`) |
| | | Preview / Dev | | Manual commercial → billing → revision matrix |

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
