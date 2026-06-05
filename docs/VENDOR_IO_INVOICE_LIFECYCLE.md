# Vendor IO & Invoice Lifecycle (Operational)

**Status:** Phase 1 in progress (May–Jun 2026)  
**Replaces:** Direct invoice creation without Vendor IO control.

> **Status transitions:** Never manually update `campaign_lines.operational_status` or `billing_status`. Use only lifecycle actions in `docs/CLEAN_RESET_EXECUTION_PLAN.md`.

## Lifecycle (strict order)

```
Assignment line (draft)
  → Generate Vendor IO (grouped by influencer)
  → io_generated
  → Generate invoice (new or append to unlocked invoice)
  → invoiced / partially_invoiced
  → Ungenerate invoice (optional) → reopened → revise VIO / regenerate lines
```

## Rules (non-negotiable)

| Rule | Implementation |
|------|----------------|
| No invoice without Vendor IO | `campaign_lines.operational_status` must be `io_generated` (or partial/invoiced for append flows) |
| Vendor IO serial | `VIO-YYYY-NNNN`, never reused; revisions use `/1`, `/2` on **new row** (prior row `is_superseded`) |
| Pre-invoice edits | Update same active VIO (amount/terms) — **no** `/n` suffix |
| Post-invoice correction | Invoice ungenerate → line `reopened` → **Revise Vendor IO** creates `/n` revision |
| Invoice serial | `INV-YYYY-NNNNN`, preserved on ungenerate/regenerate |
| One VIO per influencer per batch | Multiple selected lines for same creator → one `vendor_ios` + `vendor_io_lines` links |
| Locked invoices | No append; create new invoice instead |
| No ERP | Operational billing only — no GL/journals |

## Assignment operational status

| Status | UI color | Meaning |
|--------|----------|---------|
| `draft` | Gray | No Vendor IO |
| `io_generated` | Blue | VIO issued; invoice-eligible |
| `partially_invoiced` | Amber | Some revenue invoiced |
| `invoiced` | Green | Fully invoiced |
| `reopened` | Orange | Invoice ungenerated; correction allowed |

Content workflow continues to use `campaign_lines.assignment_status` (assigned, posted, etc.).

## Invoice operational status

Uses `invoices.regeneration_status` + `status`:

- **Active draft/sent** — append allowed if not locked
- **pending_regeneration** — ungenerated; dimmed in UI; lines → `reopened`
- **regenerated** — same `document_number`, updated lines

## Phase roadmap

| Phase | Scope |
|-------|--------|
| **1** (current) | Schema, invoice reset migration, manual VIO generation, eligibility gates, billing queue table, UI colors |
| **2** | Operational status sync; VIO revision `/n` (new row, supersede prior); append on partial/reopened; HTML invoice preview |
| **2b** | Downloadable branded PDF export |
| **3** | Method A/B polish, queue filters, audit |

## Invoice data reset (one-time)

Migration `20260605010000_vendor_io_invoice_lifecycle.sql` clears invoice tables and resets `INV-` sequence. **Vendor IO serials are preserved.** Run only when aligning production to this lifecycle.
