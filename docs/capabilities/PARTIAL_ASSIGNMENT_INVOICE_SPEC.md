# Partial Assignment Invoice — Capability Specification

**Status:** Approved for implementation (Product 2026-09-02)  
**Class:** Capability specification (functional delivery) — **not** an architecture reopen  
**Workspace:** Campaign Workspace Billing (S15)  
**Code:** `lib/billing/partial-assignment-invoice.ts` · `lib/billing/operational-invoice-draft.ts` · Campaign Finance operational billing table · invoice create/append/ungenerate · invoice HTML  
**Regression:** `npm run test:partial-assignment-invoice`

---

## Platform Architecture Compliance

| Item | Statement |
|------|-----------|
| Campaign Lifecycle stage(s) | **S15 Billing** only |
| Stakeholder Journey(s) | Finance (primary); Internal Ops (Campaign Billing) |
| Business Process components reused | Operational billing table (inline Invoice %), invoice line items, VAT engine (`computeVatLine`), Vendor IO prerequisite, Decision Center billing cues |
| Workspace(s) extended | Campaign Workspace Billing, Billing & finance workspace queue/review, invoice document. Not Studio. |
| Baselines | Architecture v1.0 · Campaign Workspace v1.3 · `VENDOR_IO_INVOICE_LIFECYCLE.md` · Financial Display Standard |
| No new navigation | Same Generate invoice / Create invoice action — amounts are edited on the operational billing rows, not in a sidebar |
| No duplicate workflow | Same Assignment → Vendor IO → Invoice → Payment order |
| Lifecycle extension | One assignment may emit unlimited invoices until remaining is 0 |
| Campaign Workspace invariants | No new nav, no competing finance ledger, Decision Center remains operational guidance |

### Operational effort

| | |
|---|---|
| Eliminated | Splitting posts/deliverables only to bill 50% of an assignment |
| Simplified | Percent and amount on the same row; Billing remaining after each invoice |
| Human | How much to bill now (percent or amount) |

### Capability completeness gates

| Gate | Answer |
|---|---|
| Bulk | Selected assignments/rows on one invoice; apply-% to all selected |
| Background | Not required for create |
| AI-ready | Slice fields are structured; no AI execution |
| Effort | Fewer commercial splits |
| Idempotent | Retry of a posted slice does not double-bill; remaining is recomputed from line items |

---

## Product rules

1. **Cap** — `sum(invoice slices for an assignment) ≤ assignment billable`. Next invoice cannot exceed remaining.
2. **Unlimited invoices** — Same assignment may appear on INV-1 … INV-n until remaining is 0.
3. **Percent and amount together** — Linked fields on the operational billing table. Blank / 100% = all remaining (today’s behaviour). The assignment (main) line % cascades to nested deliverable/post grains for the invoice; the billing table shows campaign + assignment rows only. Mixed assignment % rolls up independently.
4. **Percent is of remaining**, not of original billable (first invoice on a fresh row behaves as % of total).
5. **To Be Invoiced** = Invoice amount × Invoice %. **Remaining** = Invoice amount − To Be Invoiced. Campaign remaining is the sum of assignment remaining.
6. **VAT on the slice** — `VAT = this invoice before-VAT × assignment VAT %`. Exempt stays 0. Header tax = sum of line VAT.
7. **Invoice header shows Campaign No.** (`TW-YYYY-NNNN`) **and** campaign name. Line items keep assignment numbers (`TW-YYYY-NNNN-A`).
8. **Commercial SSOT does not change.** Only invoiced / remaining move.
9. **Vendor IO still required.**
10. **Posted invoices are not edited in place.** Correction = ungenerate / credit note.
11. **Last slice** absorbs leftover cents so remaining does not stick at 0.01.
12. **Lock** only when remaining ≈ 0. Partial does not lock the assignment.
13. **One slice per assignment grain per invoice.** Further remaining on the same open invoice updates that line item; a new INV creates a new line item.

---

## Ledger SSOT

`invoice_line_items.revenue_before_vat` is the billed slice.

```
invoiced  = sum of non-void invoice line items for that grain (excluding an ungenerated invoice)
remaining = billable − invoiced
status    = none | partially_invoiced | invoiced
```

`campaign_lines.invoice_id` = **latest** invoice, not the only invoice.

---

## Out of scope

- Studio / Planning
- Changing master commercial amounts
- Credit-note redesign
- Parallel billing tables
- Production deploy without a later explicit approval
