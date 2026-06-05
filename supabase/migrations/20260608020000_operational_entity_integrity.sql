-- =============================================================================
-- Operational entity integrity — no orphan billing / IO links
-- =============================================================================

-- Invoice line items tied to assignment deliverables must reference a campaign line
ALTER TABLE public.invoice_line_items
  DROP CONSTRAINT IF EXISTS invoice_line_items_deliverable_requires_line;

ALTER TABLE public.invoice_line_items
  ADD CONSTRAINT invoice_line_items_deliverable_requires_line
  CHECK (
    assignment_deliverable_id IS NULL
    OR campaign_line_id IS NOT NULL
  );

-- Post schedules must belong to a deliverable (column already NOT NULL; document intent)
COMMENT ON COLUMN public.assignment_post_schedule.assignment_deliverable_id IS
  'Required parent deliverable; posts cannot exist without an assignment deliverable row.';

-- vendor_io_lines already enforces campaign_line_id NOT NULL + UNIQUE per line

-- Ensure auto vendor IO triggers stay disabled (manual generation only)
DROP TRIGGER IF EXISTS auto_create_vendor_io_on_assignment ON public.campaign_influencers;
DROP TRIGGER IF EXISTS auto_create_vendor_io_on_line_assigned ON public.campaign_lines;
