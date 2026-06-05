-- Operational bootstrap must be explicit: no auto campaign_lines on header create,
-- no auto vendor IO, no silent legacy_synthetic deliverable backfill on new lines.

DROP TRIGGER IF EXISTS auto_create_vendor_io_on_line_assigned ON public.campaign_lines;

COMMENT ON TABLE public.campaign_lines IS
  'Creator assignments (explicit via Create assignment). Legacy bootstrap shells without influencer_assignment metadata should be purged.';

-- View to audit bootstrap shells (read-only; use supabase/scripts/purge_bootstrap_shell_lines.sql to delete)
CREATE OR REPLACE VIEW public.campaign_bootstrap_shell_lines AS
SELECT
  cl.id AS campaign_line_id,
  cl.campaign_header_id,
  ch.document_number AS campaign_document_number,
  ch.name AS campaign_name,
  cl.document_number AS line_document_number,
  cl.name AS line_name,
  cl.created_at
FROM public.campaign_lines cl
JOIN public.campaign_headers ch ON ch.id = cl.campaign_header_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaign_influencers ci
  WHERE ci.campaign_line_id = cl.id
)
AND (
  cl.metadata IS NULL
  OR cl.metadata->'influencer_assignment' IS NULL
  OR coalesce(cl.metadata->'influencer_assignment'->>'influencer_id', '') = ''
);

COMMENT ON VIEW public.campaign_bootstrap_shell_lines IS
  'Legacy auto-bootstrap assignment shells (no creator). Purge via scripts/purge_bootstrap_shell_lines.sql.';
