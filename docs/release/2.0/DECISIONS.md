# Release 2.0 — Locked Architecture Decisions

**Status:** Approved  
**Approved:** 2026-07-28  
**Authority:** Product / Architecture approval for Phase 1 implementation  
**Parent:** [README.md](./README.md)

These decisions are **normative**. Implementation must not reinterpret them.

---

## D-COMM — Commercial SSOT after convert (2026-07-29)

**Locked product direction:** Quotation and Campaign share **one commercial source of truth** after convert.

| Level | Rule |
|---|---|
| **Master Commercial Fields** | Always synchronized Quotation ↔ Campaign until Finance Lock (confirm + audit) |
| **Derived Financial Fields** | Never edited; recalculated from Master on both sides |
| **Operational Fields** | Campaign-only; never sync to Quotation |

| Identity | Rule |
|---|---|
| **Commercial Line ID** | Immutable; every quote-sourced Assignment permanently stores Origin CML ID |
| **Join key** | Sync / audit / revision / change orders use CML ID — never row position or copied values |
| **Cardinality** | Commercial Line → 1..N Assignments (split); future N:1 merges supported |
| **Revisions** | Change Master values/versions; **never** rewrite Origin CML IDs |

| Window | Rule |
|---|---|
| Pre-finance | Master edit either side → confirm → sync Master by CML ID → recalculate Derived → audit |
| Finance-locked | No direct Master edit; Commercial Revision required |
| Lock API | Platform gateway `Campaign.isFinanceLocked()` / `isCampaignFinanceLocked` (`lib/finance/campaign-finance-lock.ts`) — **all modules** (Commercial SSOT, PO, VIO, Invoice, Payments, Change Orders, etc.) must use it |
| Sync API | Single `CommercialSynchronizationService` + Commercial Line Registry — dirty Master fields only; field-level audit; registry-driven Derived recalc |
| Revision API | After Finance Lock: `CommercialRevisionService` only — create → submit → approve/apply → version history (append-only) |

**Implementation status:** Phases 1–4 complete. Tests: `npm run test:commercial-ssot-phase4`.

**Code bridge:** `campaign_lines.source_quotation_item_id` is the Phase 1 Origin pointer (`quotation_items.id` = Commercial Line ID).

Future modules (Change Orders, Client Variations, Budget Revisions, PO Amendments, priced Additional Deliverables, Multi-Currency Adjustments, Campaign Extensions, Assignment split/merge) **reuse** the same SSOT + identity + sync + revision framework.

**Normative spec:** [`docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md`](../../architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md)

This supersedes Phase 1 wording that treated Quotation as historical-only and Assignment as an independent live commercial book after convert. Convert projection + initial snapshot + pin + Origin CML ID remain.

---

## D1 — Convert eligibility (quotation status)

**Locked:** Only `approved` quotations may convert to Campaign Assignments.

| Status | Convert? |
|---|---|
| `approved` | **Yes** |
| `draft`, `under_review`, `sent`, `accepted`, `rejected`, `cancelled`, `archived` | **No** |
| Expired (validity) | **No** (treat as non-convertible even if status still `approved`) |

**Reason:** Campaign must start from an approved commercial baseline.

**Phase 1 note:** Keep `canCreateCampaignFromQuotation` aligned to `approved` only. Do not expand to `accepted` without a new decision.

---

## D2 — Options

**Locked:** Convert **only selected option(s)**.

Do **not** convert:

- Alternative options  
- Optional / hidden options  

**Phase 1 selection rule** (until an explicit `selected_for_conversion` column exists):

- Per creator group, the **selected** option is Option **1** (lowest positive `option_number`, or `null` treated as the primary/selected line).
- Items with `option_number >= 2` for the same creator are **alternatives** and are skipped.
- Collap packages: convert the package only when its selected option set is the primary/selected one (same rule on the package option number).

If the client later chooses another option:

```text
Quotation V2 → Commercial Revision → Difference Engine → Apply Changes
```

**Never** duplicate Assignments for unselected alternatives.

**Phase 2:** Difference Engine / Apply Changes (out of Phase 1 scope).

---

## D3 — Collap packages

**Locked:** One commercial package → **one Assignment** (`campaign_line`).

```text
Package (quotation collapse group)
  → 1 Assignment (campaign_lines)     ← financial + operational unit
       → Assignment Deliverables
            → Posts
```

| Rule | Detail |
|---|---|
| PO / revenue / cost / GP / AF | At **package Assignment** level (from package commercial leader totals) |
| Deliverable scope | Union of package members’ deliverables under that one Assignment |
| Creators in package | Link as `campaign_influencers` on the **same** line (multi-vendor on one Assignment allowed) |
| Do not | Create one Assignment per creator inside a package unless the package is commercially broken apart |

Non-package quotation items: one Assignment per selected item (typically one creator).

---

## D4 — Campaign header status after convert

**Locked:** Convert sets header status to **`planning`** (not `draft`).

**Target header lifecycle (product language):**

```text
Planning → Media Planning → Ready → Live → Completed → Closed
```

**Phase 1 mapping to current `CampaignStatus` enum:**

| Product stage | DB `campaign_headers.status` (Phase 1) |
|---|---|
| Planning | `planning` |
| Live (approx.) | `active` |
| Completed | `completed` |
| Closed / cancelled | `cancelled` or `completed` per ops |

Full enum rename (`media_planning`, `ready`, `live`, `closed`) is **Phase 2+** — do not expand enum in Phase 1 unless required for convert.

**Reason:** Campaign already originates from an approved quotation; it is not a draft offer.

---

## D5 — Backfill policy

**Locked:** Never silent. Always user- or admin-driven with logging.

| Tier | Behavior |
|---|---|
| **1** | Auto-detect campaigns created before R2.0 with quote link (or Path A shape) and **zero Assignments**. Show banner + **Backfill Assignments** button. User chooses. |
| **2** | **Dry run** preview: Assignments to create, deliverables, commercial snapshot, warnings. |
| **3** | **Execute** after confirm. Everything audited (`audit_logs`). |

No automatic batch mutation in Production without a separate ops approval.

---

## D6 — Assignment locking (planning vs execution)

**Locked:** Planning fields lock when Assignment reaches **Published**.

### Editable while status ∈ { Draft, Planning, Scheduled, Approved }

- Planned date  
- Planned creator  
- Planned platform  
- Planned deliverables  
- PO / commercial fields (subject to finance permissions & billing locks)

### After Published

| Still editable | Locked (not editable) |
|---|---|
| Metrics | Planned date |
| URL | Planned creator |
| Verification | Planned platform |
| Billing (per billing lifecycle) | Planned deliverables |
| Payments (per payment lifecycle) | |

**Phase 1 mapping note:** Existing `campaign_lines.assignment_status` enum differs (`draft`, `assigned`, `scheduled`, `posted`, …). Phase 1 must:

1. Document the product states above as the SSOT language.  
2. Treat **`posted`** (and any explicit published flag introduced later) as the **Published** lock trigger for planning fields.  
3. **Not** redesign the full enum in Phase 1 — add lock helpers that key off posted/published + performance live presence. Full status model alignment is Phase 2.

---

## D7 — Original / Current / Actual Media Plan (hard rule)

**Locked — hard architectural rule:**

| View | Rule |
|---|---|
| **Original** | Frozen after publication. **Never** edited in place. |
| **Current** | Editable **only** when linked Assignment is not Published (`Assignment.status < Published` / not posted). |
| **Actual** | Generated from Performance. **Never** editable. |

**Phase 1 scope:** Document + respect where touchpoints already exist. **No Media Plan refactor** in Phase 1 (per approval). Hard mutation guards are Phase 2 unless a Phase 1 bugfix requires a minimal guard.

---

## Phase 1 implementation scope (approved)

In scope:

- Unified Quote → Campaign conversion  
- Assignment (`campaign_line`) as Operational SSOT  
- Commercial Snapshot  
- Accepted quotation pinning  
- Assignment Deliverables  
- Provenance fields  
- Idempotent conversion  
- Feature flag (Development first)  
- Backfill wizard (opt-in: detect → dry run → execute)  
- Field ownership matrix compliance  

Out of scope (Phase 2+):

- Media Plan refactor  
- Performance refactor  
- Billing schema/behavior changes  
- Commercial Revision / Difference Engine  
- Reporting redesign  
- Full header/Assignment status enum redesign  

**Team instruction:** Do not optimize or extend beyond Phase 1 while implementing. Foundation first; zero regressions.
