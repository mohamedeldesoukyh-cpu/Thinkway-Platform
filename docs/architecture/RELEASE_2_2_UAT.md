# Release 2.2 — Client IO Enterprise Completion — UAT Checklist

**Status:** ✅ **Interactive UAT Approved · Feature Freeze Approved** (Product 2026-07-31)  
**Environment:** Preview `https://dev.thinkwaymedia.com` (authoritative build)  
**Supabase:** Development `hsxrewjcbvmbkqdlzjhs`  
**Fixture:** Campaign `TW-2026-0002` · root `CIO-2026-0002` · tip `CIO-2026-0002/A3`  
**Branch tip:** `develop` @ `09f9b741` (UAT defect fix deployed & verified)  
**Merge policy:** Feature Freeze — **no further functional enhancements**; release-critical deployment fixes only  
**Production:** ⛔ Production Review package submitted — separate Production Approval required  
**Parent:** [`RELEASE_2_2_IMPLEMENTATION.md`](./RELEASE_2_2_IMPLEMENTATION.md)  
**Production Review:** [`RELEASE_2_2_PRODUCTION_PACKAGE.md`](./RELEASE_2_2_PRODUCTION_PACKAGE.md)  
**Architecture Validation:** ✅ Approved ([`RELEASE_2_2_ARCHITECTURE_VALIDATION.md`](./RELEASE_2_2_ARCHITECTURE_VALIDATION.md))  
**Implementation Validation:** [`RELEASE_2_2_IMPLEMENTATION_VALIDATION.md`](./RELEASE_2_2_IMPLEMENTATION_VALIDATION.md)

### Feature Freeze exit criteria (Product)

- All priority scenarios **P1–P5** pass  
- No Critical or High defects open  
- Medium defects resolved or explicitly accepted with rationale  
- No architectural regressions  
- Automated suites remain green after any UAT fixes

**Feature Freeze:** ✅ **APPROVED** 2026-07-31 — DEF-R22-03 accepted as infrastructure (OPS-EMAIL on Production Review); DEF-R22-04 accepted for UX backlog.

---

## UAT Scorecard (Interactive — 2026-07-31)

| Scenario | Result | Notes |
|---|---|---|
| P1 – Client IO Lifecycle | **PASS** | Draft → select Assignments → Generate → Send → `under_client_review` → token Approve → `approved`. Dual Timeline `client_io.sent` + `client_io.under_client_review` confirmed. Email `delivery_status=failed` (DEF-R22-03) — status machine still advanced. |
| P2 – Amendments | **PASS** | Full chain Original → A1 → A2 → A3 via UI after DEF-R22-01 fix. All tips approved; priors `is_superseded=true`; **single active tip** (A3). Prior snapshots immutable (distinct md5 per revision). Milestones inherited A1→A2→A3 (50/50). |
| P3 – Billing Milestones | **PASS** | Interactive: 100% on Original (seeded for first generate), **50%/50% saved via UI** on A1 after form fix, inherited on A2/A3. Engine stress: 100%, 50/50, monthly (3), custom **60/40**, custom **40/30/30** with calendar date, and **≠100% rejected**. Payment schedule formatter matches configuration. |
| P4 – Assignment Integrity | **PASS** | Snapshot frozen at generate (`md5=ecfef70e…` on Original — unchanged through A3 supersession). Document path uses `assignment_snapshot` when status ≠ draft. Commercial revenue updates blocked with CIO present. Composer/milestones locked after send. |
| P5 – Regression | **PASS** | `npm run test:release-2-2` → **17/17** green after UAT fix. Commercial lock + Timeline contract covered. Interactive smoke of Media Plan / Assignments / Deliverables: no CIO-driven breakage observed on fixture campaign. |

---

## Defect Register

| ID | Severity | Status | Summary |
|---|---|---|---|
| DEF-R22-01 | **High** | **Fixed** (`09f9b741`) | Nested `<form>`s inside `client-io-save` prevented **Save milestones** and **Create amendment**. Fix: unnest composer/milestones/amendment outside save form (`client-io-form.tsx`). Verified on Preview: A1–A3 created; 50/50 milestones saved. |
| DEF-R22-02 | Medium | **Fixed** (`09f9b741`) | Header **Regenerate document** stayed enabled after send/approve while footer correctly disabled. Fix: gate with `isClientIoRegenerateAllowed`. |
| DEF-R22-03 | Medium | **Accepted (infra)** | Preview email `delivery_status=failed` — Gmail env missing. Lifecycle/Timeline/state machine OK. **Product accepted** as non-blocking; Production Review must verify SMTP/Gmail, templates, delivery, approval URLs (OPS-EMAIL). |
| DEF-R22-04 | Low | **Accepted (backlog)** | After **Save selection**, Generate stayed disabled until hard reload. Usability only — does not affect integrity/governance. |

---

## Fixes applied during UAT

| Commit | Change |
|---|---|
| `09f9b741` | Unnest Client IO forms; lock header regenerate after send |

---

## Automated tests (final, post-fix)

```text
npm run test:release-2-2
ℹ tests 17
ℹ pass 17
ℹ fail 0
```

Includes amendment numbering, snapshot builder, milestone 100% validation, Timeline contract labels (`client_io.sent` / `under_client_review`).

---

## Architectural stress evidence

### 1. Snapshot integrity

| Check | Result |
|---|---|
| Generate freezes `assignment_snapshot` | ✅ `ecfef70e427f8e74df3320c4bcce2239` (2 lines) |
| Original snap after A1–A3 supersession | ✅ **unchanged** (`ecfef70e…`) |
| Render uses snapshot when ≠ draft | ✅ `client-io-document-data.ts` |
| Commercial writes blocked with CIO | ✅ finance lock |

### 2. Amendment chain

| Rev | Document | Status | Superseded | Snap md5 | Milestones |
|---|---|---|---|---|---|
| 0 | `CIO-2026-0002` | approved | true | `ecfef70e…` | 1 (100%) |
| 1 | `CIO-2026-0002/A1` | approved | true | `948bff14…` | 2 (50/50) |
| 2 | `CIO-2026-0002/A2` | approved | true | `33aeffe8…` | 2 (50/50) |
| 3 | `CIO-2026-0002/A3` | approved | **false** (tip) | `e3f7a965…` | 2 (50/50) |

Active tips on campaign: **1**.

### 3. Billing schedule

| Config | Evidence |
|---|---|
| 100% | Original tip + template/unit |
| 60/40 | Engine validate + schedule format |
| 40/30/30 (+ custom date) | Engine validate + schedule format |
| Monthly (3) | Template + unit |
| 50/50 | **Interactive UI save** on A1 + inheritance |
| Totals ≠ 100% | Validation rejects |

---

## Priority scenarios (detail checklist)

| # | Scenario | Expect | Pass |
|---|---|---|---|
| P1 | **Standard lifecycle** | Draft → Generated → Sent → Under Client Review → Approved | ✅ |
| P2 | **Amendment lifecycle** | Approve → Create Amendment → `/A1` → … → A3; prior immutable | ✅ |
| P3 | **Billing milestones** | Templates; 100% enforced; on document; copied on amendment | ✅ |
| P4 | **Assignment integrity** | Selection + snapshot unchanged after live edits | ✅ |
| P5 | **Regression** | Commercial / Media Plan / Assignments / Deliverables / Timeline / R2.1 | ✅ |

**Timeline note (R-T1):** On send, Enterprise Timeline showed **both** `client_io.sent` and `client_io.under_client_review`. Tip status = `under_client_review`. ✅

---

## Functional

| # | Case | Expect | Pass |
|---|---|---|---|
| C1 | Ensure CIO on campaign | Creates/loads tip; Convert still did not auto-create | ✅ |
| C2 | Assignment composer | Can select subset of Assignments by line ID | ✅ |
| C3 | Generate with selection | PDF/HTML includes only selected Assignments; rollups match | ✅ |
| C4 | Empty selection blocked | Cannot generate with zero Assignments | ☐ |
| C5 | Preview / layouts | detailed / package / package_main still work | ☐ |
| C6 | Send + recipients | Email + `io_notifications`; tip → `under_client_review`; Timeline sent + under_client_review | ✅* (email failed — DEF-R22-03) |
| C7 | Client approve (token/portal) | Approves **current tip**; stamps approved; Timeline `client_io.approved` | ✅ |
| C8 | Create amendment | Prior tip immutable; new tip `/A1` generated; history visible | ✅ |
| C9 | Amendment content | Reflects updated selection/milestones; root chain intact | ✅ |
| C10 | Billing milestones | Templates + custom schedule persist and appear on document | ✅ |
| C11 | Timeline | generate/send/review/approve/amend/supersede events visible | ✅ |
| C12 | Finance lock | Commercial lock still engages when CIO exists | ✅ |
| C13 | Cancel | Cancelled tip; cancel audit present (dedicated Timeline emitter deferred R-T2) | ☐ |

## Regression

| # | Case | Expect | Pass |
|---|---|---|---|
| R1 | Convert | Still does not create CIO | ☐ |
| R2 | Commercial SSOT / Workspace | No unauthorized commercial writes from CIO | ✅ |
| R3 | Media Plan / Assignments / Deliverables | Unaffected (R2.1 still green) | ✅ |
| R4 | VIO / Invoice | Unaffected (milestones not executed) | ☐ |
| R5 | Client IO register `/ios/client` | Lists tip documents correctly (superseded hidden from tip lists) | ☐ |

## Sign-off

| Role | Name | Date | Result |
|---|---|---|---|
| Product | | 2026-07-31 | ✅ Interactive UAT Approved · Feature Freeze Approved |
| Finance / AM | | | |
| Engineering | | 2026-07-31 | UAT evidence filed · Production Review package submitted · tip `09f9b741` |
