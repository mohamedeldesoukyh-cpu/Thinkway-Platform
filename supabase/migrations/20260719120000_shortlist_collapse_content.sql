-- Collapse content: bundle two shortlist creators under a shared header (Collap)
-- that flows through to quotation lines and export previews.

ALTER TABLE public.discovery_shortlist_items
  ADD COLUMN IF NOT EXISTS collapse_group_id uuid,
  ADD COLUMN IF NOT EXISTS collapse_label text;

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS collapse_group_id uuid,
  ADD COLUMN IF NOT EXISTS collapse_label text;

COMMENT ON COLUMN public.discovery_shortlist_items.collapse_group_id IS
  'Shared id when two creators are collapsed into one content bundle.';
COMMENT ON COLUMN public.discovery_shortlist_items.collapse_label IS
  'Display label for the collapse header (default Collap).';

COMMENT ON COLUMN public.quotation_items.collapse_group_id IS
  'Copied from shortlist when collapsed creators are quoted.';
COMMENT ON COLUMN public.quotation_items.collapse_label IS
  'Collapse header label shown in quotation workspace and exports.';

CREATE INDEX IF NOT EXISTS discovery_shortlist_items_collapse_group_idx
  ON public.discovery_shortlist_items (shortlist_id, collapse_group_id)
  WHERE collapse_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS quotation_items_collapse_group_idx
  ON public.quotation_items (quotation_id, collapse_group_id)
  WHERE collapse_group_id IS NOT NULL;
