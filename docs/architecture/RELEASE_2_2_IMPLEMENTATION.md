# Release 2.2 — Client IO Enterprise Completion — Implementation Package

**Status:** 📋 Implementation package ready — awaiting Product approval to start coding  
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
| **Billing Milestones** | Existing commercial config patterns / terms snapshot where relevant | `client_io_billing_milestones` **or** versioned JSON on CIO — Product chooses at kickoff | **No billing engine / invoice eligibility execution in 2.2** (that is 2.3) |
| **Timeline** | `audit_logs` + Enterprise Timeline contract (`lib/timeline/*`) | CIO event names: issued, sent, approved, amended, cancelled | Deep-link to CIO / amendment |
| **Assignment Links** | `campaign_lines.id` (R2.1) | Composer selection store (junction or JSON on draft) | **No creator-name joins** for composition or commercial rollups |
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
Draft → Generated → Sent → Under Client Review → Approved
                              ↓
                    Amendments (append-only docs)
                              ↓
                         Cancelled
```

Map “Under Client Review” onto existing statuses or add one enum value — prefer **minimal enum change**.

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

| Change | Purpose |
|---|---|
| Amendment chain columns on `client_ios` **or** child `client_io_amendments` | root_id, revision/amendment number, superseded/tip flags, immutable artifact URLs |
| Selected Assignment links | `client_io_assignments (client_io_id, campaign_line_id)` **or** JSON on tip |
| Billing milestones | `client_io_billing_milestones` (preferred) **or** versioned JSON on tip |
| Optional status enum value | `under_client_review` if product language requires it |

Exact DDL in migration files at coding kickoff after Product confirms amendment numbering scheme.

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
| **2.2.B** | Append-only amendments + history UI | Prior tips immutable; tip pointer correct |
| **2.2.C** | Billing milestones config + document section | Templates + custom; no invoice execution |
| **2.2.D** | Timeline + commercial audit + notification polish | Events visible on Enterprise Timeline |
| **2.2.E** | Lifecycle status polish + UAT + Feature Freeze | Checklist green |

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
| Coding kickoff | ⛔ Pending Product “start coding” |
| Feature Freeze / Production | ⛔ Later gates |

---

## 12. Kickoff decision needed before first migration

1. **Amendment identity:** new `document_number` per amendment vs suffix (`CIO-2026-0001/A1`)?  
2. **Milestones storage:** table vs JSON on tip? (Recommendation: **table** for 2.3 billing joins.)  
3. **Assignment selection storage:** junction table vs JSON? (Recommendation: **junction**.)  
4. **Status:** add `under_client_review` or map to `sent`?

Once Product confirms these four, coding may begin on Development only.
