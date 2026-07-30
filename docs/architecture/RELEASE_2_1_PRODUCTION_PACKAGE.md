# Release 2.1 — Production Package (for review)

**Status:** ✅ **Production Complete** (2026-07-31)  
**Feature Freeze:** ✅ Approved 2026-07-31  
**Production deploy:** ✅ `dpl_7STrhfLRw3utjkVmRwr6Kj817m1e` · `app.thinkwaymedia.com` · tip `35086130`  
**Production Supabase:** `ienowhwfyxoqtzbgltno` (aligned)  
**Tag:** `v2.1.0`  
**Parent architecture:** [`ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md`](./ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md)  
**UAT:** [`RELEASE_2_1_UAT.md`](./RELEASE_2_1_UAT.md)  
**Implementation:** [`RELEASE_2_1_IMPLEMENTATION.md`](./RELEASE_2_1_IMPLEMENTATION.md)  
**Validation:** [`RELEASE_2_1_ARCHITECTURE_VALIDATION.md`](./RELEASE_2_1_ARCHITECTURE_VALIDATION.md)

---

## 1. Release summary

**Release 2.1 — Media Plan ↔ Assignment Hardening** completes Assignment-centric joins on Media Plan without redesigning Commercial or Finance.

| Deliverable | Outcome |
|---|---|
| Assignment IDs on Media Plan slots / facts / projections | Shipped |
| ID-first Planned vs Actual / Remaining | Shipped + UAT Pass |
| Multi Media Plan identity + selector | Shipped (single-plan fixture UAT; engine covered) |
| Enterprise Timeline on `audit_logs` | Shipped + U10 retest Pass |
| Grain lock guards (live / billing-locked) | Shipped (unit + draft-path UAT) |
| DEF-R21-01 Timeline UI gate | Hotfixed + Closed |

**Out of scope (untouched):** Commercial SSOT, Commercial Workspace, Client IO, Vendor IO, Billing, Payments, Credit Notes, Commercial Revision OS, Campaign Conversion redesign, new domain tables.

**Database:** No migrations. Additive JSON / `audit_logs` metadata only.

---

## 2. Commit list (release tip on `develop`)

| SHA | Type | Summary |
|---|---|---|
| `9d25a65f` | feat | Harden Media Plan ↔ Assignment architecture |
| `7eaf219` | fix | Unblock Enterprise Timeline from financeAudit gate (DEF-R21-01) |
| `388bab6c` | fix | Timeout full financeAudit bundle load path |

**Release tip for Production (when approved):** merge `develop` containing these three commits (plus docs commit) → `main` → approved Production deploy per [`RELEASE_WORKFLOW.md`](../RELEASE_WORKFLOW.md).

---

## 3. Final UAT report

| Area | Result |
|---|---|
| Assignment Integrity | ✅ Pass |
| ID-first Planned vs Actual | ✅ Pass |
| Multi Media Plans | ✅ Acceptable (fixture limitation only) |
| Enterprise Timeline (U10) | ✅ Pass (retest on `7eaf219`) |
| Grain Guards | ✅ Pass |
| Regression (approved scope) | ✅ Pass |
| Critical / High / Medium product defects | ✅ None open |

**Fixture:** TW-2026-0005 (Tuna Dolphin) on Preview `dev.thinkwaymedia.com`  
**Dev Supabase:** `hsxrewjcbvmbkqdlzjhs`  
**Automated:** `test:release-2-1` + `test:media-plan-phase1` — **58/58** (plus tab-bundle policy test in hotfix)

Full evidence: [`RELEASE_2_1_UAT.md`](./RELEASE_2_1_UAT.md).

---

## 4. Regression summary

| Surface | Status |
|---|---|
| Campaign ↔ Media Plan navigation | Pass |
| Assignments hierarchy (32 lines) | Pass |
| Deliverables documentation smoke | Pass |
| Approve / Request Changes / versioning | Pass |
| Commercial SSOT / Convert / CIO / VIO / Billing write paths | Untouched by R2.1 |
| Portal / Studio generate / MP exports / Convert flag | Not fully re-exercised in interactive UAT (known limitation) |

---

## 5. Known limitations

| ID | Type | Notes |
|---|---|---|
| INFRA-01 | Infrastructure | Redis connection closed on Preview Ops Center — tracked independently; **not** an R2.1 blocker |
| INFRA-03 | Checklist | “Missing local Supabase env” vs live Dev adapter — post-release checklist polish |
| FIXTURE-01 | UAT | Multi-plan `?planId=` switch not interactively exercised (single plan on fixture) |
| FIXTURE-02 | UAT | Live grain drag (U6) not interactively exercised (0 live Performance grains) |
| SCOPE-01 | Deferred | Portal Media Plan, full Studio regenerate, Convert, MP PDF/Excel exports not part of freeze-critical retest |

---

## 6. Rollback plan

| Layer | Action |
|---|---|
| Code | Revert Production deploy to prior `main` tip (pre-R2.1) |
| JSON Assignment fields | Additive — older readers ignore unknown fields |
| Timeline metadata | Additive — UI falls back to summary / action · entity_type |
| Schema | **No migrations** — nothing to roll back in DB |
| Commercial / Finance | Untouched — no rollback surface |

Never recreate Assignment IDs as part of rollback.

---

## 7. Production deployment checklist

**Do not execute until explicit Production Approval.**

| # | Step | Done |
|---|---|---|
| 1 | Confirm Feature Freeze still in force (no unapproved functional commits) | ☐ |
| 2 | Confirm Production target Supabase `ienowhwfyxoqtzbgltno` (never Dev) | ☐ |
| 3 | Confirm **no** Production migrations required for R2.1 | ☐ |
| 4 | Merge approved tip `develop` → `main` (or approved PR) | ☐ |
| 5 | Production deploy only after written approval (e.g. `[deploy-production]` or approved `vercel deploy --prod`) | ☐ |
| 6 | Ops Center Production: environment = Production, Supabase aligned, git SHA matches release tip | ☐ |
| 7 | Run Production smoke checklist (§8) | ☐ |
| 8 | Record release notes + Ops evidence | ☐ |

---

## 8. Production smoke test checklist

| # | Smoke | Expect |
|---|---|---|
| S1 | Open an Assignment-backed campaign Media Plan | Calendar loads; slots retain Assignment refs |
| S2 | Original / Actual / Remaining tabs | No crash; Actual empty or ID-matched when live |
| S3 | Single-plan campaign | No plan selector (or single default) |
| S4 | Timeline & activity | Enterprise Timeline renders (not stuck on Loading tab data) |
| S5 | Approve / Request Changes on a draft fixture (Dev-like campaign if available) | Baseline lock + draft tip behaviour unchanged |
| S6 | Assignments / Deliverables / Client IO tabs | No regression smoke failures |
| S7 | Ops Center | Production ↔ `ienowhwfyxoqtzbgltno`; Redis note if offline (INFRA) |

---

## 9. Release notes (draft)

### Thinkway Release 2.1 — Media Plan ↔ Assignment Hardening

**What changed**

- Media Plan calendar slots, performance facts, and Actual/Remaining projections now join on Assignment IDs (`campaign_lines` → deliverable → post), not creator labels alone.
- Campaigns may host multiple Media Plans; the header default pointer remains the primary plan.
- Enterprise Timeline shows Media Plan lifecycle events from `audit_logs` with a stable contract.
- Schedule moves are blocked for live / locked / billing-locked Assignment grains.

**What did not change**

- Commercial SSOT, quotations, Client IO, Vendor IO, billing, payments, convert flows.

**Ops notes**

- No database migration.
- Preview UAT closed DEF-R21-01 (Timeline no longer waits on finance audit).
- Redis infrastructure issues (if any) are tracked separately and do not block this release.

---

## 10. Production readiness assessment

| Criterion | Assessment |
|---|---|
| Architecture frozen & followed | ✅ |
| Implementation complete | ✅ |
| Automated tests green | ✅ |
| Preview + Interactive UAT | ✅ |
| Open Critical/High/Medium product defects | ✅ None |
| Feature Freeze | ✅ Approved |
| Schema / migration risk | ✅ None |
| Commercial / Finance blast radius | ✅ None (untouched) |
| Explicit Production Approval | ⛔ **Required before deploy** |

**Recommendation:** **Ready for Production Approval review.** Do not deploy until Product authorizes Production.

---

## 11. Production smoke evidence (2026-07-31)

| Check | Result |
|---|---|
| build-info tip | ✅ `3508613` · production · `dpl_7STrhfLRw3utjkVmRwr6Kj817m1e` |
| Supabase aligned | ✅ `ienowhwfyxoqtzbgltno` |
| Ops Center | ✅ App healthy · DB 232 ms · Redis PING ok (latency warning INFRA) |
| Media Plan (TW-2026-0001) | ✅ Original / Actual / Remaining load |
| Assignment IDs on calendar | ✅ **8/8** slots with line + deliverable + post IDs |
| Enterprise Timeline | ✅ Loads; Media Plan lifecycle events visible |
| Assignments / Deliverables | ✅ 5 assignments · Deliverables documentation repository loads |
| Commercial / Convert / CIO chrome | ✅ Campaign workspace Client IO chrome present (no write-path changes in R2.1) |

## Governance (final)

| Stage | Status |
|---|---|
| Feature Freeze | ✅ Approved |
| Documentation Commit | ✅ `35086130` (+ this closure note) |
| Production Review | ✅ Approved |
| Production Deployment | ✅ Complete |
| Tag | ✅ `v2.1.0` |
| Next | Release 2.2 — Client IO Enterprise Completion |
