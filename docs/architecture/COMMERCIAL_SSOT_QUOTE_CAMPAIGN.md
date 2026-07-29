# Commercial SSOT — Quotation ↔ Campaign (Post-Convert)

**Status:** Approved architecture — Phases 1–2 implemented (foundation + bidirectional sync with confirmation). Phases 3–4 pending approval.  
**Date:** 2026-07-29  
**Authority:** Product / Commercial Finance  
**Supersedes (for commercial amounts):** Release 2.0 dual-book language in  
[`docs/release/2.0/ASSIGNMENT_SSOT_AND_CONVERSION.md`](../release/2.0/ASSIGNMENT_SSOT_AND_CONVERSION.md) §2  
and [`docs/release/2.0/FIELD_OWNERSHIP_MATRIX.md`](../release/2.0/FIELD_OWNERSHIP_MATRIX.md)  
(“Assignment owns live revenue/cost; Quotation is historical only”) **until finance lock**.

---

## 1. Principle — one Commercial Source of Truth

Thinkway maintains **one commercial agreement**.

| View | Role |
|---|---|
| **Quotation** | Client agreement, negotiation, pricing |
| **Campaign** | Operational execution of that same agreement (schedule, delivery, finance execution) |

After a Campaign is generated from a Quotation, commercial data must **not diverge** simply because execution started.

```text
One Commercial Agreement
  ├── Quotation view  (Sales / Client)
  └── Campaign view   (Ops / Delivery / Finance)
```

Not every field behaves the same — see **§3 Commercial SSOT levels**.  
Identity and sync join keys — see **§2 Commercial Entity Identity**.

---

## 2. Commercial Entity Identity

Synchronization must **never** rely on row position, display order, or matching copied values (name, cost, creator).

Every commercial line generated from a Quotation retains a **permanent, immutable Commercial Line identity**. Campaign Assignments permanently reference that origin. The Quotation can resolve which Assignments were created from each Commercial Line.

### 2.1 Commercial Line ID (immutable)

```text
Quotation
 ├── Line A  (Commercial Line ID: CML-001)
 ├── Line B  (Commercial Line ID: CML-002)
 └── Line C  (Commercial Line ID: CML-003)

        ↓ Generate Campaign

Campaign
 ├── Assignment A  (Origin: CML-001)
 ├── Assignment B  (Origin: CML-002)
 └── Assignment C  (Origin: CML-003)
```

| Rule | Detail |
|---|---|
| **Immutable ID** | Commercial Line IDs never change once issued |
| **Assignment IDs may change** | Operational rows may be split, replaced, or restructured; **Origin Commercial Line ID stays the same** |
| **Survives revisions** | Commercial Revisions change Master **values / versions**, not Commercial Line identity |
| **Bidirectional** | Assignment → Origin Commercial Line; Commercial Line → set of Assignments (query / registry) |

**Implementation bridge (Phase 1 codebase):**  
`campaign_lines.source_quotation_item_id` is today’s origin pointer. Treat `quotation_items.id` (or a dedicated `commercial_line_id` column if introduced) as the **immutable Commercial Line ID**. Human-readable labels (`CML-001`) may be display serials; the sync join key is the immutable UUID/id. Do not drop provenance on revision, restructure, or re-save.

### 2.2 One-to-many (Commercial Line → Assignments)

Do **not** assume 1:1 forever. One Commercial Line may back **multiple** operational Assignments.

```text
Quotation: Creator A — 10 Stories  (CML-010)

Campaign:
  ├── Assignment: Creator A — 5 Stories (July)   Origin: CML-010
  └── Assignment: Creator A — 5 Stories (August) Origin: CML-010
```

```text
Commercial Line (CML-010)
        │
        ├── Campaign Assignment 1
        ├── Campaign Assignment 2
        └── Campaign Assignment 3
```

**Sync implications (1:N):**

- Master agreement amounts live on the **Commercial Line** (Quotation side)  
- Split Assignments carry operational share + Origin ID  
- Sync service resolves **all Assignments with that Origin** when applying Master changes  
- Allocation of split commercial shares (equal split, explicit split ratios, etc.) is an implementation policy owned by the sync service — never inferred from row order  

### 2.3 Many-to-one (future merges)

Future campaign merges must also be supported: multiple Commercial Lines may consolidate into one operational Assignment (primary origin + secondary origins, or an origin set). Sync registry must allow this without inventing a second join model.

### 2.4 Commercial Line Registry

`CommercialSynchronizationService` synchronizes exclusively via the **Commercial Line Registry**:

| Lookup | Purpose |
|---|---|
| Commercial Line ID → Quotation line | Master commercial facts |
| Commercial Line ID → Assignment(s) | Peer operational commercial views |
| Assignment ID → Origin Commercial Line ID | Reverse resolve for Campaign-side edits |

Deterministic and resilient to:

- Reordering  
- Campaign restructuring  
- Assignment splitting  
- Assignment merging  
- Commercial Revisions  
- Future Change Orders / PO amendments  

**Forbidden join strategies:** index/position matching, “same creator + same cost”, fuzzy name match, worksheet row number.

### 2.5 Why this matters

Stable identity enables:

- Synchronization  
- Audit  
- Version comparison  
- Commercial Revisions  
- Change Orders / PO amendments  
- History and end-to-end traceability  

…without depending on copied values.

---

## 3. Commercial SSOT levels

Commercial and related fields fall into **three groups**. Sync rules differ by group. Implementation must classify every editable field into exactly one group (field registry / map).

### 3.1 Master Commercial Fields — always synchronized

Negotiated commercial agreement. **Single source of truth.** Until Finance Lock, these stay synchronized between Quotation and Campaign (after user confirmation).

Examples:

| Area | Fields |
|---|---|
| Creator | Creator Cost, Creator Currency, Quantity, Unit Price |
| Creator charges | Production Cost, Boosting Cost, Travel, Accommodation, other custom commercial charges |
| Client | Client Revenue, Selling Price, Revenue Currency, Client Quantity, Unit Selling Price |
| Fees / structure | Agency Fee, Platform Fee, Service Fee, Commission, Markup, Margin, Discount |
| Tax / FX | Tax / VAT rates or amounts that are commercial inputs, Exchange Rate |
| Scope that prices | Deliverables that affect pricing (commercial scope) |
| Agreement totals inputs | Any other field that is an **input** to the commercial agreement |

**Rules:**

- Editable (pre-finance) from Quotation **or** Campaign  
- On confirm → write both documents via `CommercialSynchronizationService` keyed by Commercial Line ID  
- Never diverge without Finance Lock + Commercial Revision  

### 3.2 Derived Financial Fields — never edited directly

Calculated from Master Commercial Fields. **Never manually synchronized** and **never manually edited**.

Examples:

- Total Cost, Total Revenue  
- Gross Profit, Gross Margin %, Net Margin  
- Platform Profit  
- Campaign Total, Quotation Total  
- Financial Summary rollups  

**Rules:**

- UI must not expose these as free-form commercial editors  
- When any Master field changes, **recalculate on both** Quotation and Campaign  
- Display-only (or read-only computed) surfaces  

### 3.3 Operational Fields — Campaign only

Execution data. **Never synchronize** to the Quotation.

Examples:

- Campaign / Assignment / Creator status  
- Publishing Calendar, publishing dates, calendar weeks  
- Content / creator acceptance / approval status  
- Deliverable completion, workflow status  
- Asset URLs, tracking links  
- Operational notes, internal comments  
- AI scores / recommendations  
- Performance: reach, impressions, engagement, clicks, conversions, live dates  

**Rules:**

- Campaign write paths only  
- Quotation commercial sync must ignore these fields entirely  

---

## 4. Lifecycle states

```text
                  convert
Quotation ──────────────────► Linked Campaign
     │                              │
     │   PRE-FINANCE                │
     │   Master fields sync both    │
     │   (by Commercial Line ID)    │
     │   Derived recalculate both   │
     │◄────────────────────────────►│
     │                              │
     │     Campaign.isFinanceLocked │
     ▼                              ▼
 Direct Master edit BLOCKED
         │
         ▼
 Commercial Revision workflow
   → new commercial version
   → update Quotation + Campaign together
   → Origin IDs unchanged
   → recalculate Derived
   → audit + approval
```

| Phase | Master fields | Derived fields | Operational | Identity |
|---|---|---|---|---|
| **Pre-finance** | Edit either side → confirm → sync both by CML ID | Recalculate both (never edit) | Campaign only | Origin preserved |
| **Finance-locked** | Blocked; Commercial Revision required | Recalculate on revision apply | Campaign only | Origin preserved |
| **Revision approved** | New version on both | Recalculate both | Unchanged by revision unless in scope | **Commercial Line IDs unchanged** |

---

## 5. Pre-finance synchronization (Master fields)

### 5.1 Rule

Before Finance Lock (§7), changing a **Master Commercial Field** from either document:

1. Show confirmation warning  
2. On confirm: update the edited document  
3. Resolve peer(s) via **Commercial Line ID** (registry)  
4. Synchronize Master fields on the linked document(s)  
5. Recalculate **Derived** financial values on both  
6. Append Audit Trail on both sides (include Commercial Line ID)  
7. Preserve history (no silent overwrite without audit)

### 5.2 Confirmation copy (normative)

```text
This Campaign is linked to Quotation {quotation_serial}.

Updating these commercial values will automatically update both
the Quotation and the Campaign.

Do you want to continue?
```

(Mirror when editing from the Quotation, naming the Campaign document number.)

### 5.3 Field map

Quotation worksheet columns (`quotation_items.*`, package leaders, etc.) and Campaign PO / Assignment commercial columns (`campaign_lines.*`, deliverable commercial rollups) are **views of the same Master facts**, joined by Commercial Line ID — not by position.

An explicit **Master field map** (implementation artefact owned by the sync service) defines bidirectional projection. Derived fields are **not** in that map.

---

## 6. CommercialSynchronizationService

All synchronization logic lives in **one** domain service — not scattered across Quotation UI, Campaign UI, convert, billing, or IO modules.

**Proposed module:** `lib/services/commercial/commercial-synchronization-service.ts`  
(or equivalent under `lib/commercial-sync/` with a clear public facade).

### 6.1 Responsibilities

| Responsibility | Detail |
|---|---|
| Finance lock | Call campaign-level lock (§7); refuse Master edits when locked |
| Field classification | Master vs Derived vs Operational — only Master syncs |
| Identity registry | Resolve Quotation ↔ Assignment(s) by **immutable Commercial Line ID** |
| Synchronize | Project Master fields using the registry (supports 1:N / future N:1) |
| Recalculate | Run commercial engines / rollups for Derived on both sides |
| Audit | Record before/after Master changes on both documents (with CML ID) |
| Revision gate | When locked, return “revision required” instead of syncing |

### 6.2 Anti-pattern

Hardcoding quote→campaign or campaign→quote updates inside feature actions, sheets, or convert helpers. Those layers **must** call the sync service.

```text
UI / Action
   → CommercialSynchronizationService.applyMasterChange(...)
        → check Campaign.isFinanceLocked()
        → resolve Commercial Line ID (+ peer Assignment set)
        → write Master on source
        → sync Master to peer(s) by CML ID
        → recalculate Derived both
        → audit (include CML ID)
```

---

## 7. Finance lock — Campaign level

Finance Lock is evaluated **once at Campaign (header) level**, not with ad-hoc checks in each document UI.

### 7.1 Single API (normative)

```text
Campaign.isFinanceLocked()
```

Implementation shape (conceptual):

```ts
isCampaignFinanceLocked(campaignHeaderId: string): Promise<FinanceLockResult>
```

Every commercial write path (Quotation and Campaign) **must** use this method. No module may invent its own finance-lock rules.

### 7.2 Internal evaluation (any of)

| Artefact |
|---|
| Purchase Order (PO) |
| Vendor IO |
| Vendor Purchase Order |
| Invoice |
| Credit Note |
| Debit Note |
| Payment Request |
| Payment |
| Finance Approval |
| Closed Accounting Period |
| Posted Journal |
| Accrual |
| Any other downstream finance transaction |

**Default scope:** if **any** Assignment under the Campaign has a lock artefact, the **entire Campaign** commercials are locked (stricter, simpler, ERP-aligned).

### 7.3 Locked behaviour

- Direct Master commercial edit blocked on Quotation and Campaign  
- Derived remain read-only  
- Operational fields remain editable on Campaign (unless other domain rules apply)  
- User offered **Commercial Revision**  
- Commercial Line IDs remain intact  

### 7.4 Lock message (normative)

```text
This Campaign has already entered the finance process.

Commercial values can no longer be edited directly.

A Commercial Revision is required.

Do you want to create a new Commercial Revision?
```

---

## 8. Commercial Revision workflow

When finance is locked and Master commercials must change:

1. User starts **Commercial Revision**  
2. Propose new **Master** values (single commercial editor), keyed by Commercial Line ID  
3. Approval (who / when / source)  
4. On approval:
   - Create a **new commercial version** (append-only)  
   - Apply Master fields to **both** Quotation and Campaign via registry  
   - Recalculate Derived on both  
   - Write audit + approval metadata  
   - **Do not** reassign or recreate Commercial Line IDs  
5. **Never** silently overwrite prior commercial versions after finance has started  

Versioned rows extend `campaign_commercial_snapshots` (or successor) — **new row per approved revision**, never mutate historical rows. Snapshot / revision history should retain Commercial Line IDs for version comparison.

---

## 9. Future scalability

The same Commercial SSOT + Identity + Revision framework must support future modules **without new sync engines**:

| Future module | Reuse |
|---|---|
| Change Orders | Master delta by CML ID → Revision (or pre-finance sync) |
| Client Variations | Same |
| Budget Revisions | Same |
| Purchase Order Amendments | Post-lock → Revision; may also create finance artefacts |
| Additional Deliverables (priced) | New or existing CML ID + sync/revision |
| Multi-Currency Adjustments | Master FX / amounts via sync/revision |
| Campaign Extensions | Commercial portion via sync/revision; schedule = Operational |
| Assignment split / merge | Same CML ID(s); registry updated; no position matching |

**Rule:** New commercial modules call `CommercialSynchronizationService` and/or Commercial Revision, joined by Commercial Line ID. They do **not** introduce parallel synchronization or identity logic.

---

## 10. Anti-patterns (forbidden)

1. Silent divergence of Master commercials between Quotation and Campaign while pre-finance  
2. Manually editing Derived financial fields  
3. Syncing Derived fields as if they were Master  
4. Syncing Operational / performance fields to Quotation  
5. Editing Master fields after finance lock without a revision  
6. Mutating an approved commercial version / snapshot in place  
7. Duplicated finance-lock or sync logic outside `CommercialSynchronizationService` / `Campaign.isFinanceLocked()`  
8. Syncing by row position, display order, or copied value matching  
9. Clearing or rewriting Origin Commercial Line ID on revision, split, or restructure  
10. Forcing users to guess which screen is commercially authoritative  

---

## 11. Relationship to Release 2.0 convert

Convert remains the **projection event** that:

- Creates Campaign + Assignments from the approved Quotation  
- Pins `accepted_quotation_id` / version  
- Writes the **initial** commercial snapshot (version 1)  
- Seeds Master fields onto Assignments  
- Sets **Origin Commercial Line ID** on each Assignment (`source_quotation_item_id` today)  

**Change from Phase 1 R2.0 wording:** After convert and **before finance lock**, Master commercials stay **live-synchronized by Commercial Line ID**. Derived recalculate on both sides. Operational data stays Campaign-only.

After finance lock, Commercial Revision is the only path to change Master commercials — identity unchanged.

---

## 12. Implementation phases (recommended)

| Phase | Deliverable | Status |
|---|---|---|
| **0 — Spec lock** | This document + D-COMM | Done |
| **1 — Foundation** | Field registry + identity + `CommercialSynchronizationService` + audit (no UI) — `lib/services/commercial/` | **Done** |
| **2 — Bidirectional sync UI** | Confirmation dialog + wire Quotation/Campaign editors + Supabase ports + recalc + audit | **Done** |
| **3 — Finance lock** | `isCampaignFinanceLocked` / `Campaign.isFinanceLocked()` + block Master writes | Pending approval |
| **4 — Commercial Revision** | Versioned revision + approval + dual apply (IDs preserved) | Pending |
| **Later — Split / merge** | Explicit 1:N allocation policy refinements; N:1 merge origins | Pending |

**Phase 1 code:** `lib/services/commercial/` · tests: `npm run test:commercial-ssot-phase1`

---

## 13. Acceptance criteria

1. Pre-finance: edit Creator Cost (Master) on Campaign → Quotation Master updates after confirm **via Origin CML ID**; Derived totals/GP recalculate; audit written with CML ID.  
2. Pre-finance: edit Client Revenue (Master) on Quotation → linked Assignment(s) update by CML ID; confirm shown.  
3. Derived fields (e.g. Gross Profit) are not manually editable on either document.  
4. With Vendor IO present: Master edit blocked; revision prompt shown; `isCampaignFinanceLocked` is the only gate used.  
5. Approved revision creates a new commercial version; prior version retained; both views show new Master + Derived; **Commercial Line IDs unchanged**.  
6. Changing publishing dates (Operational) never alters Quotation commercials.  
7. Reordering Quotation or Campaign lines does not break sync.  
8. Two Assignments with the same Origin CML ID both resolve from that Commercial Line (1:N).  
9. No module implements its own quote↔campaign commercial sync outside the sync service, or joins peers by position/copied values.  
10. Convert always stamps Origin Commercial Line ID; it is never null for quote-sourced Assignments.

---

## 14. Open implementation choices (non-blocking)

| Topic | Default recommendation |
|---|---|
| Canonical Commercial Line ID | Prefer immutable UUID (`quotation_items.id` / `commercial_line_id`); optional display serial `CML-###` |
| Reverse index | Query Assignments by `source_quotation_item_id` (already non-unique → 1:N-ready); add explicit back-ref only if query cost requires |
| Canonical write path | All Master writes go through `CommercialSynchronizationService` |
| Package lines | Sync package Assignment Master totals ↔ package commercial leader CML ID |
| 1:N allocation | Explicit split ratios on Assignments; default equal split only when ratios absent and quantities allow |
| Margin as Master vs Derived | If margin is a **pricing input mode**, treat as Master; if display-only from cost/revenue, treat as Derived — decide per commercial engine mode in the field registry |
| Quote status after convert | Remain `approved`/`accepted` but Master-editable until finance lock via sync path |

---

**Business objective:** One commercial truth, joined by immutable Commercial Line identity; Sales and Ops can edit from either view before finance; calculated fields stay calculated; execution stays on Campaign; splits/merges and future commercial modules reuse the same registry, sync, and revision framework without duplicated logic.
