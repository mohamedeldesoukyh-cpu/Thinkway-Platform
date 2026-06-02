-- Backfill post-level invoiced amounts for deliverables already locked on invoice.
UPDATE public.assignment_post_schedule ps
SET
  invoiced_amount = round(
    COALESCE(NULLIF(ps.billable_amount, 0), ps.revenue_before_vat, 0)::numeric,
    2
  ),
  remaining_amount = 0,
  billing_status = 'invoiced',
  invoice_line_item_id = COALESCE(ps.invoice_line_item_id, ad.invoice_line_item_id),
  invoiced_at = COALESCE(ps.invoiced_at, ad.invoiced_at),
  locked_at = COALESCE(ps.locked_at, ad.locked_at)
FROM public.assignment_deliverables ad
WHERE ad.id = ps.assignment_deliverable_id
  AND ad.invoice_line_item_id IS NOT NULL
  AND (ps.remaining_amount > 0 OR ps.invoiced_amount = 0);
