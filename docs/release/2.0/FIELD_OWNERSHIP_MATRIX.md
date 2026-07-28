# Release 2.0 — Field Ownership Matrix

**Status:** Approved contract (pre-implementation)  
**Approved:** 2026-07-28  
**Parent:** [README.md](./README.md)  
**Related:** [DECISIONS.md](./DECISIONS.md) (D1–D7)

## Purpose

Every persisted business field has **exactly one owner**. Other modules may **read** or **display** it; they must not become a second write SSOT.

| Role | Meaning |
|---|---|
| **Owner** | Module/domain allowed to create/update the field under normal ops |
| **Editable by** | Role/persona (or System) that may change it |
| **Readers** | Allowed consumers (non-owning) |
| **After Published** | Lock behavior per D6 when Assignment is Published |

Violations of this matrix are architecture bugs — fix ownership, do not add parallel columns.

---

## 1. Quotation (Commercial SSOT)

Owner domain: **Commercial / Quotation**. Immutable for shortlist sync when `sent` | `approved` | `accepted`. Convert is one-way projection.

| Field / group | Owner | Editable by | Readers | Notes |
|---|---|---|---|---|
| `serial_number`, `version_number`, `parent_quotation_id` | Quotation | System | Campaign, Reporting | Version chain |
| `status` | Quotation | Commercial + approvers | Convert gate (D1) | Only `approved` converts |
| `name` | Quotation | Commercial | Campaign (seed name) | |
| `client_id` / `brand_id` / temporary names | Quotation | Commercial | Campaign (brand-first at convert) | Promote before convert |
| `currency`, `total_*_egp`, `total_af_*`, `gp_target_pct` | Quotation | Commercial | Snapshot, Reporting | Not invoice math |
| `notes`, `terms` | Quotation | Commercial | Snapshot copy | |
| `issue_date`, `validity_date` | Quotation | Commercial | Convert expiry check | |
| Signatures / portal approval fields | Quotation | Commercial / Client portal | Audit | Never copied as editable ops fields |
| `quotation_items.*` commercial engine fields | Quotation | Commercial | Convert projection | |
| `quotation_items.deliverables` JSON | Quotation | Commercial | Convert → Assignment Deliverables | |
| `option_number` | Quotation | Commercial | Convert (D2 selected only) | |
| `collapse_group_id` / `collapse_label` | Quotation | Commercial | Convert (D3 package → 1 Assignment) | |
| `campaign_header_id` | Quotation | System (convert) | UI links | Reverse link |
| Revision / version history tables | Quotation | System | Audit | Not duplicated on campaign |

---

## 2. Campaign header

Owner domain: **Campaign Ops** (except pinned commercial provenance).

| Field / group | Owner | Editable by | Readers | Notes |
|---|---|---|---|---|
| `document_number` | System | System | All | `TW-YYYY-NNNN` |
| `name` | Campaign | Operations | UI, Reports | Seeded from quote |
| `status` | Campaign | Operations | All | Convert sets `planning` (D4) |
| `brand_id` / `client_id` / `group_id` / category / VR / `agency_or_direct` | Brand master (reference) | Ops via brand change rules | Finance | Brand-first |
| `currency_code` | Campaign | Operations / Finance | Lines default | Seeded from brand; warn if ≠ quote |
| `quotation_id` | System (convert) | System | UI | Convenience link |
| `accepted_quotation_id` | System (convert) | System | Audit, Reporting | **Pin — immutable** |
| `accepted_quotation_version` | System (convert) | System | Audit | **Pin — immutable** |
| `shortlist_id` | System / Discovery bridge | System | UI | |
| `po_number` / `po_amount_*` / `po_status` | Campaign Finance | Finance | Billing display | Client PO |
| `start_date` / `end_date` | Campaign | Operations | Media Plan | |
| `campaign_object_id` / plan provenance | Campaign Plan / Studio | System | Media Plan identity | |
| `metadata` | Campaign | Operations | — | No second commercial book |

---

## 3. Commercial snapshot

| Field / group | Owner | Editable by | Readers | Notes |
|---|---|---|---|---|
| `campaign_commercial_snapshots` row | System (convert / Apply revision) | System only | Audit, Reporting, Dispute | **Immutable** after insert |
| `payload` (totals, terms, item summary) | System | System | Commercial, Finance | New row on revision (Phase 2) |

---

## 4. Assignment = `campaign_lines` (Operational SSOT)

Owner domain: **Campaign Operations / Finance** (split below). Subject to D6 locking.

| Field / group | Owner | Editable by | After Published (D6) | Readers |
|---|---|---|---|---|
| `document_number` (`-A`/`-B`) | System | System | Locked identity | All |
| `source_quotation_id` / `source_quotation_item_id` | System (convert) | System | Locked | Audit |
| `name` | Campaign | Operations | Locked if planning identity | UI |
| Planned creator (`campaign_influencers` + metadata) | Campaign | Operations | **Locked** | CRM, VIO |
| Planned platform / accounts (`metadata.line_assignment`) | Campaign / Media Plan (schedule link) | Operations | **Locked** | Media Plan |
| Planned deliverable scope (structure) | Campaign | Operations | **Locked** | Media Plan |
| `revenue` / `cost` / `po_amount` / VAT / AF on line | **Finance on Assignment** after convert* | Finance | Editable per billing rules | VIO, Billing, Reports |
| `pricing_mode` | Campaign Finance | Finance | Caution | |
| `currency_code` | Campaign Finance | Finance | Caution | |
| `assignment_status` | Campaign Ops | Operations | Advances to Published+ | All |
| `operational_status` | Billing lifecycle | System (VIO/invoice actions) | Billing machine | Billing UI |
| `vendor_io_id` / `invoice_id` | Billing / VIO | System | Per lifecycle | Finance |
| `start_date` / `end_date` (line) | Campaign | Operations | Locked if planning window | |

\*After convert, Quotation no longer owns live revenue/cost. Quotation retains historical offer amounts; Assignment owns operational PO amounts.

---

## 5. Vendor link = `campaign_influencers`

| Field / group | Owner | Editable by | After Published | Readers |
|---|---|---|---|---|
| `influencer_id` | Campaign (planned creator) | Operations | **Locked** | CRM, VIO, Payments |
| `campaign_line_id` | Campaign | System | Locked | |
| `status` / shortlist assignment status | Campaign | Operations | Ops workflow | |
| `agreed_fee` | Campaign Finance | Finance | Per finance rules | VIO |
| `vendor_payment_status` / `payment_batch_id` | **Payments** | Finance | Editable | CRM |
| `source_shortlist_*` | System | System | Locked | Discovery audit |

VIO header `vendor_ios.assignment_id` **references** this row; it does not own creator identity.

---

## 6. Assignment Deliverables = `assignment_deliverables`

| Field / group | Owner | Editable by | After Published | Readers |
|---|---|---|---|---|
| Platform / deliverable_type / quantity / label | Campaign (planned scope) | Operations | **Locked** | Media Plan, VIO |
| `service_description` | Campaign | Operations | **Locked** | UI |
| `free_for_client` | Campaign Finance | Finance | Caution | Billing |
| Unit / rollup revenue & cost / AF / VAT | Campaign Finance | Finance | Per billing locks | Billing |
| `live_date` (rollup) | **Performance** (derived/synced) | System / Ops verification | Actuals path | Actual Media Plan |
| `workflow_status` | Campaign / Performance | Operations | Advances | |
| `billing_status` / invoice locks | **Billing** | System | Billing machine | Finance |
| `notes` | Campaign | Operations | Allowed | |

---

## 7. Posts = `assignment_post_schedule`

| Field / group | Owner | Editable by | After Published | Readers |
|---|---|---|---|---|
| Planned date / sequence / label / platform / type | **Media Plan** (planned) + Campaign | Operations (Current plan, non-published) | **Locked** | Original/Current |
| `live_date` (actual) | **Performance** | Operations / System | Editable (actuals) | Actual Media Plan |
| `workflow_status` | Performance / Campaign | Operations | Editable | |
| Revenue/cost per post | Campaign Finance | Finance | Billing locks | Billing |
| `billing_status` / `invoice_line_item_id` | **Billing** | System | Billing machine | |
| URL / verification fields (when present) | **Performance** | Operations | Editable | |
| Metrics (views, eng, …) | **Performance** | System/API | Editable | Reports |

---

## 8. Media Plan (`campaign_objects` + `meta.mediaPlan*`)

| Field / group | Owner | Editable by | Rule |
|---|---|---|---|
| Current Approved Baseline (Original) | Media Plan lifecycle | System on publish only | **Frozen** (D7) — never in-place edit |
| Working Draft (Current) | Media Plan | Operations | Only for Assignments **not** Published (D7) |
| Actual / Remaining projections | Engine (derived) | **Nobody** | From Performance facts (D7) |
| `mediaPlanSchedule` item planned dates | Media Plan | Operations (Current) | Must link toward Assignment IDs over time |
| Lifecycle status / approvals | Media Plan portal | Client / Ops on behalf | Does not own PO amounts |
| Slate `quotedRevenue` display | Read from Assignment / snapshot | — | Not a write SSOT |

---

## 9. Performance / publications

| Field / group | Owner | Editable by | Readers |
|---|---|---|---|
| `campaign_publications` URLs, live timestamps | Performance | Operations / System | Actual Media Plan |
| Collected metrics | Performance | System/API | Reports, AI |
| Refresh / collection status | Performance | System | Ops |

Performance **must not** rewrite planned dates, planned creator, or quotation commercials.

---

## 10. Vendor IO

| Field / group | Owner | Editable by | Readers |
|---|---|---|---|
| `vendor_ios` document / serial / terms / revision | **Vendor IO** | Finance / Ops | Payments, CRM |
| `vendor_ios.assignment_id` → `campaign_influencers` | Vendor IO | System | |
| `vendor_io_lines.campaign_line_id` | Vendor IO | System | Billing gate |
| Amounts on VIO | Vendor IO (from Assignment at generate/revise) | Finance | Must reconcile to Assignment |

IO does not own quotation fields.

---

## 11. Billing / invoices

| Field / group | Owner | Editable by | Readers |
|---|---|---|---|
| `invoices.document_number` / status / locks | **Billing** | Finance | Reports |
| `invoice_line_items` amounts | **Billing** | Finance | — |
| `invoice_line_items.campaign_line_id` / deliverable / post FKs | Billing | System | Assignment hierarchy |
| Client `payments` / allocations | **Finance (collections)** | Finance | — |

| Forbidden | Reason |
|---|---|
| `invoices.quotation_id` | Billing uses Campaign Snapshot / Assignments only |

---

## 12. Vendor payments

| Field / group | Owner | Editable by | Readers |
|---|---|---|---|
| Payment batch / timeline | **Payments** | Finance | CRM |
| `campaign_influencers.vendor_payment_status` | Payments | Finance | Vendors UI |
| Payment readiness (bank fields) | **CRM** | Finance / Vendor | Payments gate |

---

## 13. Commercial CRM

| Field / group | Owner | Editable by | Readers |
|---|---|---|---|
| `creator_crm_profiles` | CRM | Ops / Finance | VIO terms compose |
| Activation events | CRM / System | System | Audit |
| Bank accounts / readiness | CRM | Finance | Payments |
| Rate history (future) | CRM | Finance | Quotation suggestions |

CRM does not own Assignment PO amounts.

---

## 14. Discovery / Shortlist

| Field / group | Owner | Editable by | Notes |
|---|---|---|---|
| Shortlist membership | Discovery | Ops | Sync with quote only while quote draft/under_review |
| Shortlist commercial mirrors | Discovery / sync engine | Ops | Pre-convert working copy — not post-convert SSOT |

After convert, shortlist commercials are **not** the operational SSOT.

---

## 15. AI / Studio / Reporting

| Consumer | May write? | Must read from |
|---|---|---|
| Studio slate / copilot | CampaignObject tip only (not PO SSOT) | Assignments after convert; snapshot for offer context |
| Campaign Plan facts | Plan object | Not live invoice amounts |
| Reporting | Read models / views only | Assignment hierarchy + accepted quote pin |
| Quotation AI workspace | Quotation fields only | — |

---

## 16. Quick contract (examples from approval)

| Field | Owner | Editable by |
|---|---|---|
| Revenue (offer) | Quotation | Commercial |
| Revenue (operational PO) | Assignment | Finance |
| Cost (offer) | Quotation | Commercial |
| Cost (operational) | Assignment | Finance |
| Planned date | Media Plan / Assignment planning | Operations (pre-Published) |
| Actual publish date | Performance | Operations / System |
| Views / metrics | Performance | System/API |
| Invoice number | Billing | Finance |
| Payment status | Payments / Finance | Finance |

---

## 17. Phase 1 compliance checklist

When implementing Phase 1 convert:

- [ ] Write quotation fields only via quotation services  
- [ ] Write Assignment PO/scope via `createCampaignLine` / convert service  
- [ ] Write snapshot once; never update payload in place  
- [ ] Set `accepted_quotation_*` once; never overwrite  
- [ ] Do not add quotation FKs to invoices  
- [ ] Do not invent a second revenue column owned by Media Plan  
- [ ] Backfill uses same owners as convert (Tier 2/3 logged)  

Phase 2+ features (Difference Engine, Media Plan guards, status enum alignment) must update this matrix in the same PR that changes ownership.
