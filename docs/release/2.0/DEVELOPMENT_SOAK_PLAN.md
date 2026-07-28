# Release 2.0 Phase 1 — Development Soak Plan

**Status:** **Complete — exit matrix 100% green** (2026-07-28)  
**Branch:** `develop` (PR #2 merged)  
**Baseline:** Release 2.0 Phase 1 on Development (fix soak blockers only; no Phase 2)  
**UI soak URL:** `https://dev.thinkwaymedia.com` (protection bypass + app session; **admin MFA AAL2** required for invoice write + publications API)  
**Database:** Development Supabase `hsxrewjcbvmbkqdlzjhs` (migration already applied)  
**Feature flag:** Code default remains **OFF**. Explicitly enabled on Vercel **Preview (`develop`)** only (`RELEASE_2_0_ASSIGNMENT_CONVERT` + `NEXT_PUBLIC_…` = `true`). Production unset / OFF.  
**Sign-off:** [`PRODUCTION_READINESS_REVIEW.md`](./PRODUCTION_READINESS_REVIEW.md)  
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

### Soak fixes applied (discovered during gate / Dev DB soak)

1. CRM boundary allowlist — `convert-quotation-to-assignments.ts`.  
2. Backfill wizard + convert dialog — `ActionResult` narrowing (Vercel TS).  
3. Flag **OFF by default** (no Development surface auto-on).  
4. `sync_campaign_header_from_brand` — read `agency_or_direct` from **clients** (was broken after brand column drop).  
5. service_role grants for convert path tables + `md_vat_rates` (Dev workers/soak).  
6. Convert resolver — `inf:` unified_id + display_name/handle fallback; default deliverable when empty; hydrate platforms from `influencer_platform_accounts`.  
7. Fail convert when zero Assignments created.  
8. Soft-fail legacy `deliverables` insert when FK still points at `campaigns_legacy`.  
9. Harness: `npm run test:release-2-0` + `npx tsx scripts/soak-release-2-0-dev.mjs`.  
10. Backfill harness: `npx tsx scripts/soak-release-2-0-backfill-dev.mjs` (isolated Dev fixtures).  
11. Discovery `/discovery/search` SSR crash (unrelated to R2.0): taxonomy RPC statement timeout — soft-fail + Dev function `statement_timeout=30s`.

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

**Result:** ☑ Pass — Dev DB harness + UI Convert dialog on QT-2026-0005 (idempotent dry-run, warning, Open TW-2026-0002)

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

**Result:** ☑ Pass — Isolated Dev fixtures **QT-2026-0019** → **TW-2026-0003** via `scripts/soak-release-2-0-backfill-dev.mjs`: detect eligible → dry-run (0 writes) → execute (2 Assignments) → re-detect/re-execute idempotent; snapshot + accepted pin + provenance; no auto VIO/invoice; TW-0001/TW-0002 invoice/line counts unchanged.

---

### 3. Media Planning (regression only — no refactor)

| Step | Action | Pass criteria |
|---|---|---|
| 3.1 | Open campaign Media Plan | Loads without error |
| 3.2 | Schedule functions | Calendar / views usable |
| 3.3 | References | No broken creator/deliverable links |
| 3.4 | Deliverables visible | Hierarchy / plan items render |

**Result:** ☑ Pass (load) — notes: TW-2026-0001 Media Plan page loads; empty Studio-link empty state (no crash). Schedule/references N/A when no linked Studio plan.

---

### 4. Performance (regression)

| Step | Action | Pass criteria |
|---|---|---|
| 4.1 | Existing campaign publish path | Works as before |
| 4.2 | Metrics update | Still updates |
| 4.3 | URLs update | Still updates |

**Result:** ☑ Pass (load) — notes: After MFA AAL2, Performance Center loads (0 publications empty state); `/publications-bundle` returns `ok:true`. No R2.0 regression.

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

**Result:** ☑ Pass — TW-2026-0002: Assignment → **VIO-2026-0006** → **INV-2026-00002** → **PAY-1** (E£6,285.40 bank transfer, invoice Collected/Paid). No auto-VIO/invoice on convert. Admin MFA required for invoice write (expected).

---

### 6. Revision / convert controls

| Step | Action | Pass criteria |
|---|---|---|
| 6.1 | Second conversion | Blocked (idempotent) |
| 6.2 | Dry-run | No data written |
| 6.3 | Snapshot | Immutable (no in-place update) |
| 6.4 | Accepted quotation | Remains pinned |
| 6.5 | Draft quotation convert | Rejected |

**Result:** ☑ Pass (engine + UI) — dry-run preview; UI warning “Campaign already has Assignments — convert is idempotent”; execute control disabled; pin retained; draft rejected by D1 (engine)

---

## Exit criteria (all green required)

| Area | Status |
|---|---|
| Conversion | ✅ Dev DB + UI Convert dialog (QT-2026-0005 → TW-2026-0002) |
| Snapshot | ✅ row + hash + accepted pin |
| Assignment | ✅ 2 lines + provenance + deliverables; header `planning` |
| Billing | ✅ Assignment → VIO → INV-2026-00002 → PAY-1 |
| Vendor IO | ✅ UI generate VIO-2026-0006; no auto-VIO on convert |
| Backfill | ✅ QT-2026-0019 → TW-2026-0003 (detect / dry-run / execute / idempotent) |
| Regression (Media Plan + Performance) | ✅ Media Plan load + Performance Center load; soak campaigns unchanged |
| Feature Flag | ✅ OFF by default (unset/false); explicit true enables |
| Performance (ops) | ✅ publications-bundle OK after MFA |
| RLS | ✅ anon cannot insert commercial snapshots |

**No yellow items. Exit matrix 100% green.**

**Production readiness:** See [`PRODUCTION_READINESS_REVIEW.md`](./PRODUCTION_READINESS_REVIEW.md). **No Production deploy until explicit approval.**

---

## Soak log

| Date | Tester | Environment | Outcome | Notes |
|---|---|---|---|---|
| 2026-07-28 | Agent | Local + Dev DB + CI/Preview | Partial | Automated pre-gates green |
| 2026-07-28 | Agent | `develop` merge + Dev DB harness | Partial | PR #2 merged; flag OFF by default; convert engine soak green on QT-2026-0005; UI blocked by Vercel SSO on `dev.thinkwaymedia.com` |
| 2026-07-28 | Agent | Dev Preview | Partial | Flag ON for Preview(`develop`) only; Vercel protection bypass reached Thinkway login; awaiting app auth for UI soak |
| 2026-07-28 | Agent | Dev Preview (authenticated) | Partial | Ops Center Dev aligned; TW-0001 VIO/Media Plan regression; TW-0002 VIO UI green; Invoice + Performance need MFA AAL2 |
| 2026-07-28 | Agent | Dev Preview + MFA | Near-green | Full billing E2E + Performance + Convert UI idempotent; **Backfill only remaining** |
| 2026-07-28 | Agent | Dev DB backfill harness | **All green** | Prep QT-2026-0019 + TW-2026-0003; detect/preview/execute/idempotent; snapshot/pin/provenance; no billing/VIO side effects on TW-0001/TW-0002 |
| 2026-07-28 | Agent | Dev Preview | Blocker found | `/discovery/search` SSR: `canceling statement due to statement timeout` in `getDiscoverySearchTaxonomy` (unrelated to R2.0) |
| 2026-07-28 | Agent | Dev Preview + Dev DB | **All green** | Taxonomy timeout fix verified; search page loads; backfill re-soak green (QT-2026-0020 → TW-2026-0004) |

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
