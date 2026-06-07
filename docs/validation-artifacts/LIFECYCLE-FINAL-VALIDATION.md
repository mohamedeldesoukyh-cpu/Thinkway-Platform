# LIFECYCLE-FINAL-VALIDATION-2026-06-04

Clean-room billing lifecycle validation (post PR1–PR6). **Do not use INV-2026-1.**

## Seeded state (steps 1–4 complete)

| Entity | Value |
|--------|-------|
| Campaign name | `LIFECYCLE-FINAL-VALIDATION-2026-06-04` |
| Campaign ID | `d7698a72-6b6a-491b-b012-08be3e923262` |
| Campaign number | `TW-2026-0003` |
| Assignment line | `TW-2026-0003-A` |
| Vendor IO | `VIO-2026-0006` |
| Deliverables | 2 × £1,000 (IG Reel + IG Story), `ready_to_invoice` |
| Invoices | **None** (fresh) |

**App URL:** http://localhost:3000/campaigns/d7698a72-6b6a-491b-b012-08be3e923262

**Re-seed (idempotent):** `npx supabase db query --linked -f supabase/scripts/lifecycle_final_validation_seed.sql`

## Blocker: API keys cannot drive steps 5–16

Supabase API keys (including JWT `service_role`) are **GRANT-restricted** on operational tables (`campaign_headers`, `campaign_lines`, `assignment_deliverables`, `vendor_ios`). Invoice lifecycle mutations must run through the **authenticated app** (Finance user session).

Set `SUPABASE_SERVICE_ROLE_JWT` only if extending automation — it cannot replace UI for this project's grants.

## Transition logging (run after every UI step)

1. **SQL snapshot:** `npx supabase db query --linked -f supabase/scripts/lifecycle_final_validation_snapshot.sql`
2. **Or PowerShell:** `.\scripts\capture-validation-snapshot.ps1 -Step "05-first-invoice"`
3. **Fill log:** `docs/validation-artifacts/LIFECYCLE-TRANSITION-LOG.md`
4. **Dev logs:** `[invoice-lifecycle-debug]` / `[invoice-lifecycle-commit]` in terminal

## UI validation sequence (steps 5–18)

Sign in at http://localhost:3000/login, then:

1. Open campaign `TW-2026-0003` → Assignments tab.
2. **First invoice:** select deliverable 1 only (£1,000) → Generate invoice.
3. Verify: subtotal £1,000; 1 `invoice_line_item`; deliverable 1 locked; queue correct.
4. **Append:** select deliverable 2 → Append to same invoice.
5. Verify: subtotal £2,000; 2 line items; no duplicates.
6. **Commercial change:** edit deliverable 1 revenue to £1,200 (finance override if prompted).
7. **Ungenerate** invoice → `pending_regeneration`.
8. **Regenerate** same invoice → verify:
   - Same invoice number
   - Subtotal £2,200 (£1,200 + £1,000)
   - `regeneration_status` → `active`
   - No duplicate line items
   - Assignments invoiced; no phantom Generate
9. **Ungenerate** again → all locks cleared on both deliverables.
10. **Regenerate** again → final totals match line sum.
11. Capture screenshots (billing tab, invoice workspace, queue).
12. Run scoped SQL below.

## Scoped SQL verification

```sql
-- Replace :campaign_id with d7698a72-6b6a-491b-b012-08be3e923262

-- No duplicate line items on this campaign's invoices
SELECT ili.invoice_id, ili.assignment_deliverable_id, count(*)
FROM public.invoice_line_items ili
JOIN public.invoices i ON i.id = ili.invoice_id
WHERE i.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
GROUP BY 1, 2
HAVING count(*) > 1;

-- Totals = line sum
SELECT i.document_number, i.subtotal,
       coalesce(sum(ili.revenue_before_vat), 0) AS line_sum
FROM public.invoices i
LEFT JOIN public.invoice_line_items ili ON ili.invoice_id = i.id
WHERE i.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
  AND i.status <> 'void'
GROUP BY i.id, i.document_number, i.subtotal
HAVING abs(i.subtotal - coalesce(sum(ili.revenue_before_vat), 0)) > 0.01;

-- No stale pending_regeneration after final regenerate
SELECT document_number, regeneration_status, status
FROM public.invoices
WHERE campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
  AND regeneration_status = 'pending_regeneration';

-- No stale locks on assignment line
SELECT document_number, billing_status, invoice_id, operational_status
FROM public.campaign_lines
WHERE campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
  AND billing_status IN ('invoiced', 'paid')
  AND invoice_id IS NULL;
```

## Success criteria

- [ ] No duplicate `invoice_line_items`
- [ ] `subtotal` = `SUM(revenue_before_vat)` per invoice
- [ ] Same invoice serial through regenerate
- [ ] No phantom Generate actions on locked rows
- [ ] No stale `pending_regeneration` after final regenerate
- [ ] No stale assignment locks after ungenerate
- [ ] Single toast per action (no loops)

## Promotion gate

Do **not** promote to production or resume billing features until all criteria pass on this campaign.
