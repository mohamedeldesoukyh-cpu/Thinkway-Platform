# Release 2.2 — Client IO Enterprise Completion — Implementation Package

**Status:** ✅ Development Complete · ✅ Architecture Validation **APPROVED** · ✅ Implementation Validation ready for Preview — see [`RELEASE_2_2_IMPLEMENTATION_VALIDATION.md`](./RELEASE_2_2_IMPLEMENTATION_VALIDATION.md)  
**Parent:** [`ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md`](./ENTERPRISE_OPERATIONS_FINANCE_ARCHITECTURE.md) (**APPROVED & FROZEN**)  
**Depends on:** Release 2.1 Assignment IDs (`v2.1.0`)  
**Out of scope:** Release 2.2a Planning Board · 2.2b Copilot · VIO/Billing execution (2.3) · Commercial Revision OS (3.0)  
**Queued after this release Feature Freeze:** [`RELEASE_2_2A_PLANNING_BOARD_ARCHITECTURE.md`](./RELEASE_2_2A_PLANNING_BOARD_ARCHITECTURE.md)

---

## 0. Mission

Elevate Client IO from an operational PDF/email workflow into the **Ops↔Finance commercial contract**:

- Assignment-selected composition  
- Append-only amendments (never overwrite)  
- Configurable billing milestones (schedule ownership; invoice execution in 2.3)  
- Commercial audit + Enterprise Timeline CIO events  
- Lifecycle tracking + notifications (reuse/extend existing send/approve paths)

**Thesis:** Complete and harden the CIO module we already have — do **not** invent a second commercial ledger.

---

## 1. Reuse matrix (normative)

| Capability | Reuse | New | Notes |
|---|---|---|---|
| **Client IO Header** | Existing `client_ios` + Campaign Header / Legal Entity / Brand | Minimal columns only if required for amendment tip / composer | No duplicate campaign data; no private pricing ledger |
| **Document generate / PDF / preview** | `generateClientIoDocument`, `loadClientIoDocumentData`, template, `/api/client-ios/[id]/document` | Filter by selected Assignment IDs | Keep layouts `detailed` / `package` / `package_main` |
| **Send / recipients / email** | `sendClientIoAction`, `send_recipients`, `io_notifications`, Gmail builders | Emit Timeline on send | Preserve token + portal approve |
| **Client / portal approval** | `approve_client_io_by_token`, `approve_client_io_portal`, `/io-approval/client` | Map “Under Client Review”; Timeline on approve | Do **not** replace token/portal with a new client auth system |
| **Internal approvals (optional)** | Existing `approvals` / `approval_steps` if Product wants AM→Finance internal gate | Wire optionally; not required for client-facing approve | Prefer extend over parallel workflow |
| **Amendments** | **VIO revision/supersession pattern** (`revision_number`, root pointer, superseded flag) | CIO amendment chain + immutable prior docs | Append-only; never overwrite prior CIO content |
| **Approval Flow** | Token/portal + status enum | Extend status language; audit each transition | Reuse where possible |
| **Billing Milestones** | Existing commercial config patterns / terms snapshot where relevant | Dedicated `client_io_billing_milestones` table (approved) | **No billing engine / invoice eligibility execution in 2.2** (that is 2.3) |
| **Timeline** | `audit_logs` + Enterprise Timeline contract (`lib/timeline/*`) | CIO event names: issued, sent, under_client_review, approved, rejected, amended, superseded, cancelled | Deep-link to CIO / amendment |
| **Assignment Links** | `campaign_lines.id` (R2.1) | Junction `client_io_assignments` (approved) | **No creator-name joins** for composition or commercial rollups |
| **Commercial values** | Assignment rollups / SSOT Master / campaign commercial snapshot | Display-only on CIO | Finance lock already triggered by CIO existence |
| **Finance lock** | `campaign-finance-lock.ts` reason `"client_io"` | Keep; document amendment interaction | Post-lock amount changes → Commercial Revision (R3) then CIO amendment |
| **Notifications** | `io_notifications` + email send path | In-app/Timeline visibility; optional digest later | No mandatory chat/SMS |
| **Convert** | Untouched | — | Convert still **never** auto-creates CIO |
| **Planning Board / Copilot** | — | — | **Frozen** until CIO Feature Freeze |

---

## 2. Current baseline (code)

| Fact | Today |
|---|---|
| Cardinality | **One** `client_ios` row per `campaign_header_id` |
| Document number | `CIO-YYYY-NNNN` |
| Status | `draft → generated → sent → approved` (+ `cancelled`) |
| Line selection | **All** campaign lines at generate time |
| Amendments | **None** (regenerate overwrites artifacts) |
| Milestones | Free-text `billing_terms` only |
| Timeline | Status chrome only; cancel → finance audit; send/approve → `io_notifications` |
| Key modules | `features/io/*`, `lib/io/client-io-*`, RPCs `ensure_client_io_for_campaign`, `send_client_io`, approve-by-token/portal |

---

## 3. Target design

### 3.1 Product lifecycle

```text
Draft → Generated → Under Client Review → Approved
                         ↑
                    (send action; sent_at + Timeline client_io.sent)
                              ↓
                    Amendments (append-only docs · /A1…)
                              ↓
                         Cancelled
```

**Normative tip status after send:** `under_client_review` (not a durable `sent` tip status). Send remains an auditable action via `sent_at` + Timeline `client_io.sent`.

### 3.2 Assignment-selected composer

- AM/Finance selects Assignments (`campaign_lines.id[]`) before generate/send.  
- Document commercial rollups = **selected lines only**.  
- Persist selection with the CIO tip (junction table preferred for queryability; JSON acceptable for MVP if RLS/query needs stay simple).  
- Empty selection blocked; “select all active” helper allowed.

### 3.3 Append-only amendments

Pattern (mirror VIO):

```text
CIO root (v1 / document_number CIO-YYYY-NNNN)
  → Amendment 1 (new document_number or CIO-YYYY-NNNN/A1 — decide in kickoff)
  → Amendment 2
```

| Rule | Detail |
|---|---|
| Immutability | Prior tip frozen (artifacts + commercial snapshot of that version) |
| Tip pointer | Campaign resolves “current” CIO tip for lock/display |
| Content | Full regenerated document for amendment scope (selected lines + milestones) |
| Audit | Timeline: `client_io.amended` with from→to refs |

### 3.4 Configurable billing milestones

| Pattern | Support |
|---|---|
| 100% upfront | One milestone |
| 50/50 | Kickoff + completion |
| Monthly | Calendar milestones |
| Campaign completion | Single end milestone |
| Custom | User-defined schedule |

**2.2 owns schedule config + document display.**  
**2.3** executes invoice eligibility against milestones — do not build invoice engine changes here.

### 3.5 Enterprise Timeline events (minimum set)

| Event | When |
|---|---|
| `client_io.issued` / generated | Document generated |
| `client_io.sent` | Email send |
| `client_io.approved` | Token or portal approve |
| `client_io.amended` | Amendment tip created |
| `client_io.cancelled` | Cancel cascade (already partially audited) |

Metadata must include `campaign_header_id`, `client_io_id`, optional amendment root/tip IDs, Assignment IDs when relevant. Use `buildEnterpriseTimelineMetadata` / emit helpers from R2.1.

### 3.6 Commercial audit

Every meaningful change (generate, send, approve, amend, milestone edit on draft tip, cancel) writes:

- Enterprise Timeline (`audit_logs`), and  
- Keep/extend `io_notifications` for email/portal operational trail  

No second commercial money ledger on CIO.

---

## 4. Proposed database changes (Dev-first)

> **Do not apply Production migrations until Production approval.** Validate on Development Supabase `hsxrewjcbvmbkqdlzjhs` first.

| Change | Purpose | Slice |
|---|---|---|
| `client_io_assignments` junction | Selected Assignments for composition | **2.2.A** ✅ Dev |
| `client_ios.assignment_snapshot` | Freeze Assignment state at issue | **2.2.A** ✅ Dev |
| `under_client_review` enum value | Sent vs awaiting client decision | **2.2.A** ✅ Dev |
| `client_io_billing_milestones` | 2.3-ready milestone schedule | Schema **2.2.A** ✅ · UI **2.2.C** |
| Amendment chain + `/A1` numbering | Append-only CIO versions | **2.2.B** |

Migrations (Development `hsxrewjcbvmbkqdlzjhs` only; **not** Production):
- `20260731120000_release_2_2_client_io_composer.sql` — Slice 2.2.A
- `20260731130000_release_2_2_client_io_amendments.sql` — Slice 2.2.B
- `20260731140000_release_2_2_client_io_milestones_workflow.sql` — Slice 2.2.C + send→`under_client_review`

---

## 5. Service / UI changes (planned)

| Area | Work |
|---|---|
| Composer UI | Campaign CIO tab: Assignment multi-select before generate |
| Milestone editor | Draft tip: templates + custom rows; render into PDF Section billing |
| Amendment action | “Create amendment” → freeze tip → new tip → regenerate |
| Document loader | Filter lines by selected Assignment IDs; attach milestones |
| Timeline emitters | Wire generate/send/approve/amend |
| Register / workspace | Show tip + amendment history (analogous to VIO revisions) |
| Portal / token | Continue to approve **current tip** only |

**Untouched:** Convert, Commercial SSOT write paths, Media Plan, VIO grouping, Invoice posting, Payments, Planning Board.

---

## 6. Phased delivery inside 2.2

| Slice | Deliverable | Exit |
|---|---|---|
| **2.2.A** | Assignment composer + generate/preview/PDF parity | Selected-line docs match rollups |
| **2.2.B** | Append-only amendments + history UI | ✅ Implemented on Development — prior tips immutable; tip pointer correct |
| **2.2.C** | Billing milestones config + document section | ✅ Templates + custom + document schedule; no invoice execution |
| **2.2.D** | Timeline + commercial audit + notification polish | ✅ Core CIO events wired (generate/send/review/approve/amend/supersede) |
| **2.2.E** | Lifecycle status polish + UAT + Feature Freeze | ⏳ Architecture Validation → Preview → UAT |

Slices can land as sequential PRs on `develop`; Feature Freeze only after full UAT.

---

## 7. Automated tests (planned)

```bash
# Proposed suite name
npm run test:release-2-2
```

Cover at minimum:

- Composer rejects empty selection; includes only selected Assignment IDs  
- Document pricing rollup = selected lines  
- Amendment freezes prior tip; tip advances  
- Milestone templates serialize/deserialize  
- Timeline metadata for CIO events  
- Finance lock still engages when CIO exists  
- Convert still does not create CIO  

---

## 8. UAT checklist

See [`RELEASE_2_2_UAT.md`](./RELEASE_2_2_UAT.md).

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Dual commercial display vs SSOT | CIO displays Master/Assignment rollups only; no CIO-owned price edits |
| Amendment UX complexity | Copy VIO revise language; one tip; history panel |
| Milestone → billing scope creep | Explicitly defer invoice eligibility to 2.3 |
| One-row-per-campaign UNIQUE constraint | Amendment design must relax or replace UNIQUE with tip/root model |
| Portal approve ambiguity | Always approve current tip; deep-link document number |

---

## 10. Production rollout plan

1. Implement + test on `develop` → Dev Preview  
2. Interactive UAT (`RELEASE_2_2_UAT.md`)  
3. Feature Freeze (CIO only)  
4. **Then** queue **2.2a Planning Board** implementation  
5. Explicit Production approval → migrate Dev-validated migrations → deploy  
6. Production smoke: ensure/generate/send/approve; amendment; Timeline; lock  

**Rollback:** code revert; additive migrations preferred; tip pointer must remain consistent.

---

## 11. Governance

| Gate | Status |
|---|---|
| Enterprise Architecture | ✅ Approved & frozen |
| R2.2 scope decision | ✅ Client IO first; 2.2a/2.2b queued |
| Implementation package | ✅ This document |
| Coding kickoff | ✅ Complete — 2.2.A/B/C + under_client_review on Development |
| Architecture Validation | ✅ Approved 2026-07-31 |
| Implementation Validation | ✅ Complete — Preview authorized |
| Feature Freeze / Production | ⛔ Later gates |

---

## 12. Kickoff decisions (approved)

| # | Decision | Approved choice | Notes |
|---|---|---|---|
| 1 | Amendment identity | **Suffix** `CIO-YYYY-NNNN/A1`, `/A2`, … | Slice **2.2.B** implements chain; numbering locked now |
| 2 | Milestones storage | **Dedicated table** `client_io_billing_milestones` | Schema in 2.2.A for 2.3 readiness; editor UI in **2.2.C** |
| 3 | Assignment selection | **Junction** `client_io_assignments` | Composer + generate filter in **2.2.A** |
| 4 | Status | **Add** `under_client_review` | Distinguishes sent vs awaiting client decision |

### Additional architecture directives (approved)

1. Client IO remains **append-only**; approved versions immutable; amendments create new versions.
2. Each issued Client IO captures an **Assignment snapshot**; later schedule changes must not alter historical documents.
3. Significant CIO events emit Enterprise Timeline (`audit_logs`): Generated, Sent, Under Client Review, Approved, Rejected, Amendment Created, Superseded, Cancelled.
4. Milestone rows must be consumable by Release **2.3** billing without transformation.
