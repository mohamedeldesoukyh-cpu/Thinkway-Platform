-- PR1: Invoice line uniqueness + duplicate repair (billing lifecycle stabilization)
-- Ensures one operational row cannot own multiple active invoice lines per invoice.

-- ---------------------------------------------------------------------------
-- 1. Repair duplicates before adding unique indexes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.repair_invoice_line_item_duplicates(
  p_invoice_id uuid DEFAULT NULL
)
RETURNS TABLE (
  invoice_id uuid,
  removed_line_item_id uuid,
  kept_line_item_id uuid,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_keep uuid;
BEGIN
  -- Duplicate posts on same invoice: keep row referenced by post, else highest revenue
  FOR r IN
    SELECT
      ili.invoice_id AS inv_id,
      ili.assignment_post_schedule_id AS post_id,
      array_agg(ili.id ORDER BY
        CASE WHEN ps.invoice_line_item_id = ili.id THEN 0 ELSE 1 END,
        ili.revenue_before_vat DESC NULLS LAST,
        ili.created_at ASC NULLS LAST
      ) AS line_ids
    FROM public.invoice_line_items ili
    LEFT JOIN public.assignment_post_schedule ps
      ON ps.id = ili.assignment_post_schedule_id
    WHERE ili.assignment_post_schedule_id IS NOT NULL
      AND (p_invoice_id IS NULL OR ili.invoice_id = p_invoice_id)
    GROUP BY ili.invoice_id, ili.assignment_post_schedule_id
    HAVING count(*) > 1
  LOOP
    v_keep := r.line_ids[1];
    FOR i IN 2..array_length(r.line_ids, 1) LOOP
      UPDATE public.assignment_post_schedule
      SET invoice_line_item_id = v_keep
      WHERE invoice_line_item_id = r.line_ids[i];

      UPDATE public.assignment_deliverables
      SET invoice_line_item_id = v_keep
      WHERE invoice_line_item_id = r.line_ids[i];

      DELETE FROM public.invoice_line_items WHERE id = r.line_ids[i];

      invoice_id := r.inv_id;
      removed_line_item_id := r.line_ids[i];
      kept_line_item_id := v_keep;
      reason := 'duplicate_post_on_invoice';
      RETURN NEXT;
    END LOOP;
  END LOOP;

  -- Duplicate deliverables on same invoice (no post grain)
  FOR r IN
    SELECT
      ili.invoice_id AS inv_id,
      ili.assignment_deliverable_id AS deliverable_id,
      array_agg(ili.id ORDER BY
        CASE WHEN ad.invoice_line_item_id = ili.id THEN 0 ELSE 1 END,
        ili.revenue_before_vat DESC NULLS LAST,
        ili.created_at ASC NULLS LAST
      ) AS line_ids
    FROM public.invoice_line_items ili
    LEFT JOIN public.assignment_deliverables ad
      ON ad.id = ili.assignment_deliverable_id
    WHERE ili.assignment_deliverable_id IS NOT NULL
      AND ili.assignment_post_schedule_id IS NULL
      AND (p_invoice_id IS NULL OR ili.invoice_id = p_invoice_id)
    GROUP BY ili.invoice_id, ili.assignment_deliverable_id
    HAVING count(*) > 1
  LOOP
    v_keep := r.line_ids[1];
    FOR i IN 2..array_length(r.line_ids, 1) LOOP
      UPDATE public.assignment_deliverables
      SET invoice_line_item_id = v_keep
      WHERE invoice_line_item_id = r.line_ids[i];

      UPDATE public.assignment_post_schedule
      SET invoice_line_item_id = v_keep
      WHERE invoice_line_item_id = r.line_ids[i];

      DELETE FROM public.invoice_line_items WHERE id = r.line_ids[i];

      invoice_id := r.inv_id;
      removed_line_item_id := r.line_ids[i];
      kept_line_item_id := v_keep;
      reason := 'duplicate_deliverable_on_invoice';
      RETURN NEXT;
    END LOOP;
  END LOOP;

  -- Reverse-link collisions: one post linked to multiple line items globally
  FOR r IN
    SELECT
      ps.id AS post_id,
      array_agg(ili.id ORDER BY
        CASE WHEN ili.invoice_id = ps_inv.invoice_id THEN 0 ELSE 1 END,
        ili.revenue_before_vat DESC NULLS LAST
      ) AS line_ids,
      max(ili.invoice_id) AS inv_id
    FROM public.assignment_post_schedule ps
    JOIN public.invoice_line_items ili ON ili.id = ps.invoice_line_item_id
    LEFT JOIN public.invoice_line_items ps_inv
      ON ps_inv.assignment_post_schedule_id = ps.id
      AND ps_inv.invoice_id = ili.invoice_id
    WHERE ps.invoice_line_item_id IS NOT NULL
      AND (p_invoice_id IS NULL OR ili.invoice_id = p_invoice_id)
    GROUP BY ps.id
    HAVING count(DISTINCT ili.id) > 1
  LOOP
    v_keep := r.line_ids[1];
    FOR i IN 2..array_length(r.line_ids, 1) LOOP
      UPDATE public.assignment_post_schedule
      SET invoice_line_item_id = v_keep
      WHERE invoice_line_item_id = r.line_ids[i];

      DELETE FROM public.invoice_line_items WHERE id = r.line_ids[i];

      invoice_id := r.inv_id;
      removed_line_item_id := r.line_ids[i];
      kept_line_item_id := v_keep;
      reason := 'post_reverse_link_collision';
      RETURN NEXT;
    END LOOP;
  END LOOP;

  -- Recalculate totals for affected invoices
  FOR r IN
    SELECT DISTINCT ili.invoice_id AS inv_id
    FROM public.invoice_line_items ili
    WHERE p_invoice_id IS NULL OR ili.invoice_id = p_invoice_id
  LOOP
    PERFORM public.recalculate_invoice_totals(r.inv_id);
  END LOOP;
END;
$$;

-- Run repair for all invoices (idempotent)
SELECT * FROM public.repair_invoice_line_item_duplicates(NULL);

-- ---------------------------------------------------------------------------
-- 2. Unique protections (partial — only when operational grain is set)
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS invoice_line_items_invoice_post_unique_idx
  ON public.invoice_line_items (invoice_id, assignment_post_schedule_id)
  WHERE assignment_post_schedule_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoice_line_items_invoice_deliverable_unique_idx
  ON public.invoice_line_items (invoice_id, assignment_deliverable_id)
  WHERE assignment_deliverable_id IS NOT NULL
    AND assignment_post_schedule_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS assignment_post_schedule_invoice_line_item_unique_idx
  ON public.assignment_post_schedule (invoice_line_item_id)
  WHERE invoice_line_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS assignment_deliverables_invoice_line_item_unique_idx
  ON public.assignment_deliverables (invoice_line_item_id)
  WHERE invoice_line_item_id IS NOT NULL;
