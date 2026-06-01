-- Display order for campaign line assignments within a campaign header.

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY campaign_header_id
      ORDER BY document_number, created_at
    ) - 1 AS rn
  FROM public.campaign_lines
)
UPDATE public.campaign_lines cl
SET sort_order = ranked.rn
FROM ranked
WHERE cl.id = ranked.id
  AND cl.sort_order = 0;

CREATE INDEX IF NOT EXISTS campaign_lines_header_sort_order_idx
  ON public.campaign_lines (campaign_header_id, sort_order);

COMMENT ON COLUMN public.campaign_lines.sort_order IS
  'Display order of assignment lines within a campaign header.';
