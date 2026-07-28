# Release 2.0 — Assignment SSOT & Quotation Conversion Contract

**Status:** Approved for Phase 1 (2026-07-28)  
**Parent:** [RELEASE_2_0_ARCHITECTURE.md](./RELEASE_2_0_ARCHITECTURE.md)  
**Normative decisions:** [DECISIONS.md](./DECISIONS.md) · [FIELD_OWNERSHIP_MATRIX.md](./FIELD_OWNERSHIP_MATRIX.md)

---

## 1. Assignment definition

**Campaign Assignment** is the operational execution unit:

```text
campaign_lines                          ← Assignment root (TW-YYYY-NNNN-A)
  ├── campaign_influencers              ← vendor identity / CRM / VIO header
  ├── assignment_deliverables           ← scope + commercial/billing rollup
  │     └── assignment_post_schedule    ← post rows (schedule + finest invoice grain)
  └── metadata.line_assignment          ← platform/account selection payload
```

| Property | Rule |
|---|---|
| Document number | Existing line serial `-A`, `-B`, … |
| PO / finance | `po_amount`, `revenue`, `cost`, VAT, `operational_status`, `vendor_io_id`, `invoice_id` |
| One creator per Assignment (Phase 1) | Primary `campaign_influencers` row on the line (current `createCampaignLine` behavior) |
| Packages (Collap) | **D3:** one package → **one Assignment**; member deliverables/posts as children; multi-creator via `campaign_influencers` on same line; PO/GP/AF at package line |

**Not an Assignment:** bare `campaign_influencers` without a line (legacy Path A output). Those are **vendor links only** and are a migration target for backfill.

---

## 2. Quotation vs Assignment ownership

| Data class | Quotation | Assignment |
|---|---|---|
| Offer serial / version / signatures | Owns | Pin reference only |
| Terms & commercial assumptions | Owns | Optional copied snapshot (immutable) |
| Pricing worksheets / input mode | Owns | Not re-edited as quote math; PO fields only |
| Packages / options / free-for-client | Owns (selection at convert) | Resulting scope + amounts |
| Creator identity | Snapshot + influencer FK | Reference `influencer_id` |
| Deliverable descriptions | Owns at offer time | Copied onto `assignment_deliverables` (ops-visible) |
| Planned schedule | Tentative hints | Posts enriched by Media Plan |
| Live date / URL / metrics | — | Performance |
| VIO / invoice / payment status | — | Owns |

**Anti-pattern:** Maintaining editable cost/revenue on both `quotation_items` and `campaign_lines` as two books after convert. After convert, **Assignment PO fields are operational truth**; Quotation remains historical offer truth.

---

## 3. Convert preconditions

| Check | Rule |
|---|---|
| Status | **D1:** Quotation `approved` only (not sent/accepted/draft/…). Also reject expired validity. |
| Brand | Master brand required (no temporary brand) |
| Idempotency | If campaign already pinned / quote already linked with Assignments, **block** re-create |
| Selection | **D2:** Selected options only — Phase 1: Option 1 / primary per creator (or package); skip `option_number >= 2` |
| Packages | **D3:** One collapse group → one Assignment (not one per member creator) |
| Influencer | Skip items/packages that cannot resolve at least one `influencer_id` (surface in result) |

---

## 4. Field contract — lean projection

### 4.1 Header writes

| Field | Source | Notes |
|---|---|---|
| `brand_id` (+ client/group/category/VR/currency dims) | Brand master | Brand-first |
| `name` | Quote name / user override | Editable after |
| `status` | **`planning`** | **D4** — not `draft` |
| `quotation_id` | Quote id | Keep convenience FK |
| `accepted_quotation_id` | Quote id | **NEW** — pin (immutable) |
| `accepted_quotation_version` | `version_number` / serial | **NEW** — pin |
| `shortlist_id` | Quote shortlist / auto-create | Keep |
| `po_amount` / currency | Sum of projected Assignment revenues (or quote total_revenue) | Optional seed |

### 4.2 Commercial snapshot (NEW table sketch)

`campaign_commercial_snapshots`

| Column | Purpose |
|---|---|
| `id`, `campaign_header_id` | Ownership |
| `quotation_id`, `quotation_serial`, `version_number` | Provenance |
| `payload` jsonb | Frozen totals, terms hash/text, item summaries |
| `created_at`, `created_by` | Audit |

Snapshot is **immutable**. New Apply-revision writes a new snapshot row (Phase 1.5).

### 4.3 Assignment (`campaign_lines`) writes at convert

| Carry | Source | Do not carry |
|---|---|---|
| `source_quotation_id` / `source_quotation_item_id` | Quote | — |
| Influencer + platforms/types | Item + deliverables JSON | Full quote engine modes as editable dual book |
| `revenue` / `cost` / `po_amount` / `currency_code` | Item (entry currency) | Separate EGP worksheet unless line already has FX columns in use |
| AF → `agency_fee_percent` / amounts | Item `af_*` | — |
| Deliverable rows | Expand `deliverables` → `assignment_deliverables` | Collapsed UI-only state |
| `service_description` | Item / deliverable | — |
| `free_for_client` | Deliverable flag | — |
| Tentative dates | Deliverable schedule fields → post metadata / live_date hint | Final confirmed live dates |
| `operational_status` | `draft` | VIO/invoice state |
| `pricing_mode` | Map from package vs per-deliverable | Re-run quote commercial engine |

### 4.4 Explicitly quote-only (not on Assignment)

- Client portal approval / signatures  
- Quotation revision history tables  
- Unselected options  
- Temporary client/brand names  
- Full `terms` accordion (except snapshot copy)  
- Internal approval workflow on the quote document  

---

## 5. Convert algorithm (target)

```text
convertQuotationToAssignments(quotationId, { campaignName?, optionPolicy? })
  1. Load quote; enforce preconditions
  2. If existing campaign with Assignments for this pin → return alreadyExists
  3. Ensure shortlist link (existing helper)
  4. Create or reuse draft campaign_headers; set accepted_* pins
  5. Insert campaign_commercial_snapshots from quote
  6. Map items → ExecutionLineSeed (reuse quotation-execution-mapper)
  7. For each seed: createCampaignLine(...) + schedule inheritance
  8. Link quote.campaign_header_id; link shortlist; CRM dual-event (existing)
  9. Audit: quotation.converted_to_assignments
  10. Return campaignId, lineIds, skippedItems
```

**Deprecate as primary UX:** Path A “Create campaign” that only inserts `campaign_influencers`.  
**Integrate:** Path B calls the same core after resolving seeds (quote preferred, else plan slate) and always sets quote pins when a quotation source exists.

---

## 6. Quotation V1 → Assignments → Quotation V2

| Event | Behavior |
|---|---|
| Convert V1 | Pin V1; create Assignments |
| Generate QT V2 | New draft quote; may copy `campaign_header_id`; **does not** mutate Assignments |
| Edit V2 | No campaign write |
| Approve V2 | Banner: “Campaign out of sync with Quotation Vn” |
| Apply revision (Phase 1.5) | User-confirmed diff: add/remove/reprice Assignments; new snapshot; **skip locked/invoiced lines** |
| Second Convert | Blocked |

Phase 1 minimum: pin + block duplicate convert + “open existing campaign” CTA. Apply-revision UI may follow in Phase 1.5.

---

## 7. Relationship to existing mappers

| Existing asset | R2.0 role |
|---|---|
| `mapQuotationItemsToExecutionLineSeeds` | **Reuse** as convert core |
| `createCampaignLine` | **Reuse** as Assignment factory |
| `createCampaignFromQuotation` | Replace body with unified convert (keep action name or alias) |
| `generateCampaignFromCampaignPlan` | Call shared convert/seed pipeline; fix quote FK gap |
| `seedFromQuotation` (Studio hydrate) | After convert, prefer Assignment hierarchy seed; quote hydrate remains for pre-convert Studio |

---

## 8. Product decisions

**Locked** — see [DECISIONS.md](./DECISIONS.md) (D1–D7). Do not reopen in Phase 1 PRs.

## 9. Assignment locking (D6) — convert implications

Convert creates Assignments in a pre-Published planning state (`assignment_status` starts as existing enum default / `assigned` as appropriate). Planning fields remain editable until Published (`posted` as Phase 1 lock trigger). See field ownership matrix for which columns lock.
