# Release 2.2 — Architecture Validation Report

**Release:** 2.2 — Client IO Enterprise Completion  
**Parent:** [`ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md`](./ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md) (**APPROVED & FROZEN**)  
**Implementation package:** [`RELEASE_2_2_IMPLEMENTATION.md`](./RELEASE_2_2_IMPLEMENTATION.md)  
**UAT checklist:** [`RELEASE_2_2_UAT.md`](./RELEASE_2_2_UAT.md)  
**Status:** ✅ **APPROVED** (Product 2026-07-31)  
**Date:** 2026-07-31  
**Branch:** `develop`  
**Environment validated:** Development Supabase `hsxrewjcbvmbkqdlzjhs` only  
**Next:** [`RELEASE_2_2_IMPLEMENTATION_VALIDATION.md`](./RELEASE_2_2_IMPLEMENTATION_VALIDATION.md) → commit → push → Preview  
**Production:** ⛔ Still gated

---

## 0. Executive verdict

Release 2.2 Development is **architecturally sound** and faithful to the approved enterprise model:

```text
Campaign Header
  → Client IO tip (append-only amendment chain)
       → client_io_assignments (campaign_lines.id)
       → assignment_snapshot (frozen at generate)
       → client_io_billing_milestones (schedule only)
       → audit_logs (Enterprise Timeline)
```

| Gate | Result |
|---|---|
| Historical integrity | **PASS** |
| Assignment integrity | **PASS** |
| Billing milestones | **PASS** |
| Workflow | **PASS** (lifecycle language clarified below) |
| Timeline | **PASS with documented RISKs** |
| Regression (R2.1 / Media Plan / Commercial / Assignments) | **PASS** |
| Automated tests | **PASS** — `npm run test:release-2-2` (17) · `npm run test:release-2-1` (30) |

**Recommendation:** Product **approves Architecture Validation**, then proceed to Implementation Validation packaging → commit → push `develop` → Preview. Do **not** open Preview until this document is signed off.

Queued after Feature Freeze (unchanged): Release **2.2a** Planning Board · **2.2b** Copilot.

---

## 1. Scope confirmed (in / out)

| In scope (shipped on Dev) | Out of scope (frozen) |
|---|---|
| Assignment composer + junction | Invoice eligibility / billing engine (→ 2.3) |
| Assignment snapshot at generate | Commercial Revision OS (→ 3.0) |
| Append-only amendments `/A1…` | Media Plan Planning Board (→ 2.2a) |
| Billing milestones configuration UI | AI Copilot (→ 2.2b) |
| Send → Under Client Review → Approve | Production deploy |
| Enterprise Timeline CIO events | Convert redesign |

---

## 2. Migrations (Development applied)

| Migration | Purpose |
|---|---|
| `20260731120000_release_2_2_client_io_composer.sql` | `under_client_review`; `assignment_snapshot`; `client_io_assignments`; `client_io_billing_milestones` |
| `20260731130000_release_2_2_client_io_amendments.sql` | Chain columns; tip uniqueness; `/A{n}` document numbers; tip-aware `ensure_client_io_for_campaign` |
| `20260731140000_release_2_2_client_io_milestones_workflow.sql` | Milestone due fields; `rejected` enum; send→`under_client_review`; approve accepts review status |

**Production migrations:** none applied.

---

## 3. Validation focus results

### 3.1 Historical integrity — **PASS**

| Check | Evidence |
|---|---|
| Snapshot written at generate | `lib/io/client-io-document-service.ts` → `captureAssignmentSnapshot` → `client_ios.assignment_snapshot` |
| Preview uses snapshot after issue | `loadClientIoDocumentData`: `useSnapshot` when not draft and snapshot present; generate uses `forceLive` |
| Later schedule edits do not rewrite issued docs | Snapshot path ignores live `assignment_deliverables` |
| Amendments freeze prior tip | `createClientIoAmendment`: prior tip `is_superseded=true` only; artifacts not overwritten |
| Regenerate blocked after send / on superseded | `isClientIoRegenerateAllowed` = draft/generated; superseded throws |

**Note:** Changing Assignment selection while still `generated` clears the snapshot until regenerate — intentional tip invalidation, not mutation of a sent/approved version.

### 3.2 Assignment integrity — **PASS**

| Check | Evidence |
|---|---|
| Junction is ID-based | `client_io_assignments (client_io_id, campaign_line_id)` |
| Composition filter | `filterLinesBySelectedIds` / snapshot line ids |
| No creator-name joins for rollups | Pricing/deliverable assembly uses `campaign_lines.id` + `assignment_deliverables.campaign_line_id` |
| Display names | `parseLineAssignment(metadata)` for labels only — not join keys |

### 3.3 Billing milestones — **PASS**

| Check | Evidence |
|---|---|
| Templates | 100% approval · 50/50 · Monthly(3) · Completion · Custom (`lib/io/client-io-milestones.ts`) |
| 100% enforcement | `validateClientIoMilestones` — `|total−100| ≤ 0.01`; negatives / >100% rejected |
| Edit lock | Editable only tip `draft`/`generated`; locked after send |
| Amendment inherit | `create-client-io-amendment.ts` copies schedule rows; clears 2.3 execution stamps |
| No billing engine | No invoice eligibility / posting paths added |

### 3.4 Workflow — **PASS**

**Effective tip status path:**

```text
draft → generated → under_client_review → approved
                         ↓
                   amendment tip (/A1…) → draft → …
```

| Transition | Mechanism |
|---|---|
| → generated | `generateClientIoDocument` |
| → under_client_review | RPC `send_client_io` (sets `sent_at`, status = `under_client_review`) |
| → approved | `approve_client_io_by_token` / `approve_client_io_portal` |
| → amendment tip | `createClientIoAmendment` (supersedes prior) |

**Guards:** composer / milestones / regenerate locked after send; superseded tips immutable.

**Lifecycle clarification (normative for UAT):**  
Product diagrams may show discrete `Sent` then `Under Client Review`. Implementation records **send as an action** (`sent_at` + Timeline `client_io.sent`) and persists tip status as **`under_client_review`**. There is no durable tip status of `sent` after a successful send. This matches “awaiting client decision” reporting while preserving a send audit event.

### 3.5 Enterprise Timeline — **PASS with RISKs**

| Event | Emitter |
|---|---|
| `client_io.generated` | `client-io-document-service.ts` |
| `client_io.sent` | `sendClientIoAction` |
| `client_io.under_client_review` | `sendClientIoAction` (same send) |
| `client_io.approved` | Token page + portal approve action |
| `client_io.superseded` | `create-client-io-amendment.ts` |
| `client_io.amendment_created` | `create-client-io-amendment.ts` |

| RISK | Disposition (Product 2026-07-31) |
|---|---|
| **R-T1** Dual Timeline emits on send (`sent` + `under_client_review`) | ✅ **Accepted intentional** — action audit vs state audit. Tip SSOT after send = `under_client_review`. |
| **R-T2** Contract events `client_io.rejected` / `client_io.cancelled` lack dedicated emitters | ⏳ **Deferred** — non-blocking backlog; wire when those transitions are productized. |
| **R-T3** Approve RPCs still accept legacy `draft`/`generated` | ✅ **Accepted** — compat now; tighten in a future cleanup release. |

### 3.6 Regression — **PASS**

| Surface | Result |
|---|---|
| Media Plan / R2.1 engines | Untouched — `test:release-2-1` green (30) |
| Commercial SSOT mutation | Untouched (test fixture fields only) |
| Assignment hierarchy mutation engines | Untouched |
| Convert | Untouched |
| Invoice / payment engines | Untouched (milestones schedule-only) |
| CIO change surface | `features/io/*`, `lib/io/client-io-*`, timeline contract, campaign CIO wiring, portal/token approve, three migrations |

---

## 4. Automated evidence

```bash
npm run test:release-2-2   # 17 pass (composer, snapshot, amendments, milestones, timeline labels)
npm run test:release-2-1   # 30 pass (regression)
```

TypeScript: clean at Architecture Validation (`tsc --noEmit`).

---

## 5. Architecture principles checklist

| Principle | Met? |
|---|---|
| Complete/harden existing CIO — no second commercial ledger | ✅ |
| Assignment IDs as composition keys (R2.1 join model) | ✅ |
| Append-only amendments; approved versions immutable | ✅ |
| Milestones = schedule ownership; billing exec in 2.3 | ✅ |
| Enterprise Timeline on `audit_logs` | ✅ |
| Development-first; Production gated | ✅ |
| 2.2a / 2.2b frozen until CIO Feature Freeze | ✅ |

---

## 6. Product sign-off

| Question | Response |
|---|---|
| Architecture Validation accepted? | ✅ **Yes** |
| Accept R-T1 dual send Timeline events as intentional? | ✅ **Yes** |
| Defer R-T2 rejected/cancelled emitters? | ✅ **Yes (deferred)** |
| Accept R-T3 approve RPC compatibility? | ✅ **Yes** |
| Approve proceed to Implementation Validation → commit → push → Preview? | ✅ **Yes** |

**Sign-off:** Product · **Date:** 2026-07-31

---

## 7. Next stage

```text
Architecture Validation ✅
  → Implementation Validation ✅
  → Commit on develop
  → Push develop (Preview deploy)
  → Interactive UAT (RELEASE_2_2_UAT.md)
  → Feature Freeze
  → Production Approval (separate)
  → Production (migrations + deploy)
  → Smoke + Release Closure
```

**Still not authorized:** Production DB writes, Production deploy, or starting 2.2a/2.2b implementation.
