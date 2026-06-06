# Billing Lifecycle Stabilization Audit

**Date:** Jun 2026  
**Branch:** `finance-phase2-stabilization`  
**Purpose:** End-to-end audit before further symptom fixes. Defines source of truth, valid transitions, gaps, and stabilization sequence.

**Related:** `docs/VENDOR_IO_INVOICE_LIFECYCLE.md`, `docs/ARCHITECTURE_ALIGNMENT.md`, `lib/billing/invoice-lifecycle-debug.ts`

---

## Executive summary — why state is inconsistent

Nine reported symptoms share **five architectural gaps**:

| Gap | Symptoms caused |
|-----|-----------------|
| **No DB uniqueness on invoice line ownership** | Duplicate invoice rows (#5), exploded totals (#3), phantom lines |
| **Split unlock paths (ungenerate vs lock)** | Posts stay locked after ungenerate; assignments show "Generate Invoice" (#1), statuses drift (#6) |
| **Multiple writers to lifecycle without transaction** | Append + regenerate + lock each partial; same invoice in multiple states (#9) |
| **Regenerate rebuilds line items but not operational locks** | Totals wrong (#2,#3), pending_regeneration stuck (#4), queue/workspace desync (#7) |
| **Read-path eligibility ≠ write-path truth** | UI shows generate when DB says invoiced; queue rollups disagree with workspace (#1,#7) |

**Stabilization principle:** One write pipeline, one totals RPC, one sync pipeline, DB constraints for invariants app cannot enforce alone.

### Implementation status (Jun 2026)

| PR | Status | Key artifacts |
|----|--------|---------------|
| **PR1** | Migration ready | `supabase/migrations/20260613010000_invoice_line_uniqueness_and_repair.sql` — apply with `supabase db push` |
| **PR2** | Wired | `invoice-lifecycle-operational.ts`; `invoice-locks.ts` delegates unlock/relock |
| **PR3** | Wired | `commitInvoiceLifecycleMutation()` — create/append/ungenerate/regenerate/void/unpost |
| **PR4** | Wired | `regenerateInvoiceLineItems()` UPDATE-in-place; `regeneration_status → active` after regenerate |
| **PR5** | Wired | `invoice_line_item_id`, `linked_invoice_id`, `invoice_regeneration_status` on operational rows |
| **PR6** | Wired | `lib/billing/invoice-lifecycle-scenarios.test.ts` (10 scenarios) |

**Before regenerate retest:** Run PR1 migration to repair INV-2026-1 duplicates.

---

## PHASE 1 — Source of truth

### Commercial truth (revenue/cost amounts)

| Entity | Owns commercial truth | Notes |
|--------|----------------------|-------|
| `campaign_lines` | Package-level revenue/cost, VAT%, locks | Authoritative for assignment-level commercials when line = package PO |
| `assignment_deliverables` | Deliverable-level `revenue_before_vat`, `billable_amount` | Authoritative for partial/deliverable billing |
| `assignment_post_schedule` | Post-level `revenue_before_vat`, `billable_amount` | Authoritative for post-granular billing (finest grain) |
| `vendor_ios` (+ revisions) | Vendor cost IO commercial snapshot | IO revision creates new row; same document number + suffix |

**Rule:** Invoice lines must snapshot commercial values **at lock time** from the finest selected grain (post > deliverable > line). Regenerate must re-read current commercial truth from those tables, not stale `invoice_line_items`.

### Lifecycle truth (invoiced / locked / regeneration)

| Entity | Owns lifecycle truth | Notes |
|--------|---------------------|-------|
| `invoices` | Invoice header lifecycle: `status`, `regeneration_status`, `is_operational_locked`, `document_number` | **One row per invoice number** — never duplicate |
| `invoice_line_items` | Which operational rows are on which invoice + billed amounts | Active lines = source for totals |
| `assignment_post_schedule` | Post lock: `locked_at`, `invoice_line_item_id`, `invoiced_amount` | Bidirectional link to line item |
| `assignment_deliverables` | Deliverable lock: same fields | Parent rollup for posts |
| `campaign_lines` | Assignment billing: `billing_status`, `operational_status`, `invoice_id`, locks | **Derived** from children when partial; authoritative when package-only |
| `finance_documents` | Finance registry mirror (`source_table` + `source_id` UNIQUE) | 1:1 with invoice entity |
| `invoice_versions` | Audit snapshots (ungenerate/regenerate history) | Immutable history only |

### Derived / cache / UI only (must recompute from lifecycle truth)

| Surface | Built from | Must NOT be written independently |
|---------|------------|-----------------------------------|
| Billing queue row (`loadBillingCampaignQueue`) | `operational_rows` + `syncCampaignBillingState` + line rollups | `billing_status` on queue is derived |
| `OperationalBillingRow` tree | `campaign_lines` + deliverables + posts + invoice linkage | `is_invoice_eligible`, labels |
| `syncAssignmentInvoiceProgress` | Progress math on amounts | Pure function — no DB |
| `syncOperationalBillingState` | Normalizes OPS from billing progress | Read-path only today |
| Invoice workspace totals display | `reconcileInvoiceHeaderFromLines` | Read validation only |
| "Generate Invoice" / "Regenerate" button | `resolveInvoiceActionLabel`, `isOperationalRowInvoiceEligible` | UI eligibility — must match DB locks |

### Truth hierarchy (write order)

```
commercial change (line/deliverable/post)
  → vendor IO revision (if needed)
    → invoice_line_items (snapshot)
      → assignment_* lock fields
        → campaign_lines billing/ops (rollup or lock)
          → invoices header (totals via RPC, regeneration_status)
            → finance_documents (registry)
```

---

## PHASE 2 — Invoice lifecycle map

### Canonical states

**Invoice header (`invoices.status`):** `draft` | `sent` | `partial` | `paid` | `void` | …  
**Regeneration (`invoices.regeneration_status`):** `active` | `pending_regeneration` | `regenerated`  
**Operational lock:** `invoices.is_operational_locked` + line-level locks

Product terms mapped to code:

| Product term | Code reality today | Target behavior |
|--------------|-------------------|-----------------|
| draft | `status=draft`, `regeneration_status=active` | Editable invoice, lines lockable |
| generated | First `createInvoiceFromLinesAction` (new) | Creates invoice + line items + locks |
| appended | `createInvoiceFromLinesAction` (append) | **UPDATE** existing lines on same invoice |
| reopened | `ungenerate` → `pending_regeneration` | Lines unlocked for edit; **same invoice number** |
| pending_regeneration | `regeneration_status=pending_regeneration` | Awaiting `regenerateInvoiceAction` |
| regenerated | `regeneration_status=regenerated` | Lines rebuilt; status returns toward active |
| locked | `is_operational_locked=true` + line locks | No commercial/IO edit |
| void | `status=void` | Terminal; unlock via finance lifecycle |
| unposted | `unpostInvoice` in `invoice-lifecycle.ts` | Finance reversal path |

### Transition table

| Transition | Trigger | Records that MUST update | Records that MUST NOT duplicate | Totals | Status sync |
|------------|---------|--------------------------|--------------------------------|--------|-------------|
| **New invoice** | `createInvoiceFromLinesAction` (new) | `invoices` INSERT, `invoice_line_items` INSERT, post/deliverable locks, `campaign_lines`, `finance_documents` | New `document_number` only | `recalculate_invoice_totals` | `lockInvoiceAssignments` |
| **Append uninvoiced** | create (append) | INSERT new line items only | No second invoice header | RPC once at end | Lock new lines |
| **Append invoiced rows** | create (append) | **UPDATE** existing `invoice_line_items` by id | **No INSERT** for same post/deliverable | RPC once | Re-lock assignments |
| **Ungenerate** | `ungenerateInvoiceAction` | `assignment_deliverables` unlock, `campaign_lines` reset, `invoices.regeneration_status=pending_regeneration`, `invoice_versions` snapshot | Invoice header kept (same number) | **No change today** ⚠️ | Posts **NOT reset** ⚠️ |
| **Regenerate** | `regenerateInvoiceAction` | DELETE all line items → INSERT from deliverables; `regeneration_status=regenerated`; `invoice_versions` | Same invoice id | RPC 2–3× today ⚠️ | `lockInvoiceAssignments` |
| **Sent/paid lock** | Payment / finance | `lockInvoiceAssignments`, `is_operational_locked` | — | No line change | Full lock |
| **Void/unpost** | `invoice-lifecycle.ts` | `unlockInvoiceAssignments` | — | Lines may remain | Unlock |

### Invalid states observed in production (bugs)

1. `pending_regeneration` + stale locked posts → UI offers "Generate Invoice"
2. Duplicate `invoice_line_items` per post → totals sum N× commercial
3. `campaign_lines.billing_status=moved_to_billing` while posts `invoiced` + `invoice_line_item_id` set
4. `regeneration_status=regenerated` but `is_operational_locked=false` and lines not invoiced
5. Append INSERT instead of UPDATE → duplicate lines + £1.35M-style explosions

---

## PHASE 3 — Line item ownership

### Current rules (application layer)

| Path | Create | Update | Delete |
|------|--------|--------|--------|
| New invoice | INSERT line items | — | Rollback deletes invoice on failure |
| Append | INSERT if new row | UPDATE if `invoice_line_item_id` on target invoice | — |
| Regenerate deliverable | DELETE all → INSERT | — | Full replace |
| Regenerate package fallback | INSERT package lines | — | Only if no deliverable ids |

**Files:** `lib/billing/invoice-from-posts.ts`, `lib/billing/invoice-from-deliverables.ts`, `features/billing/actions.ts`

### Gaps

| Issue | Risk | Fix |
|-------|------|-----|
| **No UNIQUE** `(invoice_id, assignment_post_schedule_id)` | Duplicate posts on same invoice | DB partial unique index |
| **No UNIQUE** `(invoice_id, assignment_deliverable_id)` | Duplicate deliverables | DB partial unique index |
| **No UNIQUE** `assignment_post_schedule.invoice_line_item_id` | One post → two line items | DB unique where not null |
| Ungenerate skips `assignment_post_schedule` | Stale post locks | Extend `unlockDeliverablesForInvoice` |
| `regenerateInvoiceFromDeliverables` ignores post-level items | Post-only invoices rebuild wrong | Rebuild from line items grain, not deliverables only |
| Same post in `posts[]` twice | Double INSERT | Dedupe input array |
| Post + deliverable path same entity | Overlapping locks | Single grain per action |
| `campaign_lines.invoice_id` only set on full lock | `lockInvoiceAssignments` misses partial | Resolve line ids from line items (partially fixed) |

### Line uniqueness target

```
ONE active invoice_line_item per (invoice_id, assignment_post_schedule_id)
ONE active invoice_line_item per (invoice_id, assignment_deliverable_id)
ONE invoice_line_item per assignment_post_schedule.invoice_line_item_id (reverse FK)
```

---

## PHASE 4 — Totals engine

### Canonical function (already exists)

```sql
recalculate_invoice_totals(p_invoice_id)  -- migration 20260531210000
```

Sums **active** `invoice_line_items.revenue_before_vat` + `revenue_vat_amount` → updates `invoices` header.

**Trigger:** `after_invoice_line_item_change` fires RPC on every line INSERT/UPDATE/DELETE.

### Current callers (redundant)

| Location | When |
|----------|------|
| DB trigger | Every line change (automatic) |
| `lockPostsOnInvoice` | End of loop |
| `lockDeliverablesOnInvoice` | End of loop |
| `regenerateInvoiceFromDeliverables` | End |
| `insertPackageAssignmentLineItems` | If inserted > 0 |
| `createInvoiceFromLinesAction` | After sync |
| `regenerateInvoiceAction` | 2× |

### Stabilization rule

1. **Writes:** Only the DB trigger recalculates during single-row ops.
2. **Batch mutations:** Wrap in transaction; call `recalculate_invoice_totals` **once** at commit.
3. **Remove** redundant RPC calls from lock helpers (or make them no-op if trigger already ran).
4. **Never** UPDATE `invoices.subtotal/total` from TypeScript.

### Totals explosion root cause (£1.35M)

Duplicate line items for the same post/deliverable each carry full `unit_price`. Trigger sums all rows → N × commercial. **Fix is dedupe + unique constraints**, not recalculate logic.

---

## PHASE 5 — Lifecycle synchronization

### Current state (scattered)

| Function | Type | Called from |
|----------|------|-------------|
| `syncInvoiceOperationalStates` | Write | `createInvoiceFromLinesAction` only |
| `lockInvoiceAssignments` | Write | create, regenerate, syncInvoiceOperationalStates |
| `unlockInvoiceAssignments` | Write | finance lifecycle (void/unpost) |
| `unlockDeliverablesForInvoice` | Write | **ungenerate only** (bypasses unlockInvoiceAssignments) |
| `lockPostsOnInvoice` / `lockDeliverablesOnInvoice` | Write | create — partial line rollup |
| `syncLineBillingFromDeliverables` | Write | Per line after lock |
| `syncLineOperationalStatusBatch` | Write | Ad hoc |
| `syncCampaignBillingState` | **Read only** | Queue load |
| `syncAssignmentInvoiceProgress` | **Read only** | Not wired post-mutation |
| `syncOperationalBillingState` | **Read only** | Not wired post-mutation |

### Target: single post-mutation pipeline

```typescript
// lib/billing/invoice-lifecycle-sync.ts (NEW)
async function commitInvoiceLifecycleMutation(supabase, input: {
  invoiceId: string;
  mutation: "create" | "append" | "ungenerate" | "regenerate" | "void" | "unpost";
  touchedLineIds: string[];
  touchedPostIds?: string[];
  touchedDeliverableIds?: string[];
}) {
  // 1. Verify line item uniqueness (pre-commit)
  // 2. Apply mutation (caller-specific)
  // 3. recalculate_invoice_totals once
  // 4. sync assignment billing + OPS from locks (write-path)
  // 5. lock/unlock invoice operational state
  // 6. ensure finance_documents
  // 7. emit structured debug log
}
```

All actions (`create`, `append`, `ungenerate`, `regenerate`) call this **once** at the end — no partial syncs inside lock helpers.

### Ungenerate must reset all grains

- `assignment_deliverables` ✅ today
- `assignment_post_schedule` ❌ **missing**
- `campaign_lines` partial ✅
- `invoice_line_items` — keep until regenerate (by design) but mark invoice `pending_regeneration`

---

## PHASE 6 — Regeneration architecture

### Business rules → code mapping

| Case | Required behavior | Current code | Gap |
|------|-------------------|--------------|-----|
| **A. Unchanged** | Reuse IO + update line amounts if needed | `regenerateInvoiceFromDeliverables` re-reads deliverables | Post-level invoices skip deliverable rebuild |
| **B. Commercial change** | Revise IO `/1`; UPDATE line item; same invoice # | `reviseVendorIoBatch` in coverage | OK if coverage runs |
| **C. New uncovered** | Block until new Vendor IO | `analyzeIoCoverage` blocked case | OK |
| **D. Append invoiced** | UPDATE line items; no duplicate | `updateExistingOnTargetInvoice` | Fails if `linked_invoice_id` wrong or INSERT path taken |
| **E. Ungenerate → regenerate** | Same invoice #; clean locks; rebuild lines | Ungenerate leaves posts locked | **Broken cycle** |

### Regeneration state machine (target)

```
active ──ungenerate──► pending_regeneration ──regenerate──► regenerated ──(auto)──► active
         │                                              │
         └─ invoice # preserved ─────────────────────────┘
```

**Today:** `regenerated` may not return to `active`; `pending_regeneration` can persist if regenerate fails mid-flight or UI shows stale data.

**Fix:** After successful regenerate, set `regeneration_status = 'active'` (or document that `regenerated` is terminal until next ungenerate). Align appendable invoice checks with this.

---

## PHASE 7 — Database protection (recommended migrations)

### Migration: `20260613010000_invoice_line_uniqueness.sql`

```sql
-- One line item per post per invoice
CREATE UNIQUE INDEX IF NOT EXISTS invoice_line_items_invoice_post_unique
  ON public.invoice_line_items (invoice_id, assignment_post_schedule_id)
  WHERE assignment_post_schedule_id IS NOT NULL;

-- One line item per deliverable per invoice
CREATE UNIQUE INDEX IF NOT EXISTS invoice_line_items_invoice_deliverable_unique
  ON public.invoice_line_items (invoice_id, assignment_deliverable_id)
  WHERE assignment_deliverable_id IS NOT NULL;

-- One line item owns a post (reverse link)
CREATE UNIQUE INDEX IF NOT EXISTS assignment_post_schedule_invoice_line_unique
  ON public.assignment_post_schedule (invoice_line_item_id)
  WHERE invoice_line_item_id IS NOT NULL;
```

### Migration: transactional regenerate function (optional Phase 2)

PL/pgSQL function `regenerate_invoice_lines(p_invoice_id)` that DELETE+INSERT+recalculate in one transaction.

### Integrity check function (diagnostic)

```sql
-- detect invoices where header total != sum(lines)
-- detect duplicate post/deliverable links per invoice
```

See `supabase/scripts/invoice_billing_links.sql` (extend for production diagnostics).

---

## PHASE 8 — Debug instrumentation & test matrix

### Existing instrumentation

`lib/billing/invoice-lifecycle-debug.ts` — logs on append/regenerate:
- `touchedLineIds`, line items before/after, totals, assignment statuses, update vs create counts, duplicate detection

**Extend to:** ungenerate, new invoice create, void/unpost. Prefix: `[invoice-lifecycle-debug]`.

### Structured log schema (target)

```json
{
  "phase": "append/regenerate:complete",
  "invoiceId": "...",
  "mutation": "append",
  "touchedLineIds": [],
  "lineItemOps": { "updated": [], "created": [] },
  "totalsBefore": {},
  "totalsAfter": {},
  "assignmentStatusBefore": [],
  "assignmentStatusAfter": [],
  "hasDuplicateLineItems": false,
  "recalculateError": null
}
```

### Deterministic test matrix

| # | Scenario | Setup | Action | Assert |
|---|----------|-------|--------|--------|
| 1 | First invoice generation | Uninvoiced posts selected | New invoice | 1 header, N line items, totals = sum, lines `invoiced`, no duplicates |
| 2 | Append uninvoiced rows | Draft invoice exists | Append new posts | Line count +M, totals increase, same `document_number` |
| 3 | Append already invoiced rows | Posts on target invoice | Append same posts | `updated_count` > 0, `created_count` = 0, totals reflect commercial |
| 4 | Regenerate unchanged | `pending_regeneration` | Regenerate | Same line count, totals unchanged, `regeneration_status` advances |
| 5 | Regenerate changed commercials | Revise IO first | Regenerate | Line amounts updated, IO suffix `/1`, invoice # same |
| 6 | Ungenerate + regenerate | Invoiced assignment | Ungenerate → Regenerate | No duplicate lines; posts unlocked then re-locked; assignments `invoiced` |
| 7 | Partial invoicing | 2 of 4 posts | Invoice 2 posts | Line `partially_invoiced`, 2 line items only |
| 8 | Reopened invoice | After ungenerate | UI shows regenerate not generate | `resolveInvoiceActionLabel` = regenerate |
| 9 | Mixed selection append | Invoiced + new posts | Append | 1 update + 1 create; `has_duplicate_line_items` = false |
| 10 | Billing queue sync | After any of above | Reload queue + workspace | Queue `already_invoiced` matches line rollups |

---

## Stabilization implementation sequence (recommended PRs)

Do **not** merge more conditional fixes until this sequence is underway.

### PR1 — Data repair + constraints (DB)
- Unique indexes (Phase 7)
- Script to dedupe existing `invoice_line_items` per invoice
- Integrity report for INV-2026-1 class issues

### PR2 — Unified unlock (ungenerate fix)
- `unlockInvoiceOperationalRows(invoiceId)` resets posts + deliverables + lines consistently
- `ungenerateInvoiceAction` uses it
- Remove bypass of `unlockInvoiceAssignments`

### PR3 — Single commit pipeline (application)
- `commitInvoiceLifecycleMutation` wrapper
- Refactor `createInvoiceFromLinesAction` to use it
- Dedupe `posts[]` / `deliverables[]` input
- One `recalculate` at end; remove redundant calls from lock helpers

### PR4 — Regenerate grain correctness
- Rebuild line items from **invoice line item grain** (post vs deliverable vs package)
- Post-level invoice path through regenerate
- Set `regeneration_status` → `active` after success (or document `regenerated` semantics)

### PR5 — UI eligibility alignment
- `isOperationalRowInvoiceEligible` respects `invoice_line_item_id` + `pending_regeneration`
- `resolveInvoiceActionLabel` uses same linkage as DB
- Hide "Generate Invoice" when fully invoiced on active invoice

### PR6 — Test matrix automation
- `lib/billing/invoice-lifecycle-scenarios.test.ts` (tsx runner)
- CI smoke for totals + duplicate detection

---

## Symptom → root cause quick reference

| # | Symptom | Root cause |
|---|---------|------------|
| 1 | Invoiced lines show "Generate Invoice" | UI eligibility ignores `invoice_line_item_id`; posts not reset on ungenerate |
| 2 | Append/regenerate inconsistent totals | UPDATE vs INSERT branching + duplicate lines |
| 3 | Totals exploded (£1.35M) | Duplicate `invoice_line_items` summed by trigger |
| 4 | Pending regeneration indefinitely | Regenerate incomplete or status not advanced; stale UI cache |
| 5 | Duplicate invoice entries | No DB unique; append INSERT path |
| 6 | Assignments not invoiced/locked | `lockInvoiceAssignments` empty lineIds; partial lock rollup overwrites |
| 7 | Queue/workspace desync | Read-path rollup vs stale `campaign_lines.billing_status` |
| 8 | Ungenerate/regenerate corrupts | Posts not unlocked; regenerate deletes lines without re-locking posts |
| 9 | Multiple lifecycle states | Non-transactional multi-step mutations |

---

## Files to treat as canonical during stabilization

| Concern | Canonical file(s) |
|---------|-------------------|
| Invoice create/append | `features/billing/actions.ts` → `createInvoiceFromLinesAction` |
| Regenerate/ungenerate | `features/billing/actions.ts` |
| Line lock (post) | `lib/billing/invoice-from-posts.ts` |
| Line lock (deliverable) | `lib/billing/invoice-from-deliverables.ts` |
| Totals RPC wrapper | `lib/billing/invoice-from-deliverables.ts` → `recalculateInvoiceTotals` |
| Assignment lock | `lib/finance/invoice-locks.ts` |
| Validation context | `lib/billing/invoice-validation-context.ts` |
| UI eligibility | `lib/billing/operational-billing-rows.ts`, `lib/billing/regeneration-eligibility.ts` |
| Queue read model | `lib/billing/operational-billing-query.ts`, `lib/billing/billing-sync-engine.ts` |
| Debug | `lib/billing/invoice-lifecycle-debug.ts` |
| DB totals | `supabase/migrations/20260531210000_vat_tax_engine.sql` |

---

*This document is the stabilization source of truth until Phase 1–6 PRs land. Update `ARCHITECTURE_ALIGNMENT.md` § Vendor IO & invoice lifecycle when PR1–PR3 merge.*
