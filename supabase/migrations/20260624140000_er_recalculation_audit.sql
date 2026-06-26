-- ER recalculation audit trail on publication_metric_sync_logs.

ALTER TABLE public.publication_metric_sync_logs
  ADD COLUMN IF NOT EXISTS previous_er numeric,
  ADD COLUMN IF NOT EXISTS new_er numeric,
  ADD COLUMN IF NOT EXISTS previous_method text,
  ADD COLUMN IF NOT EXISTS new_method text;

COMMENT ON COLUMN public.publication_metric_sync_logs.previous_er IS
  'Engagement rate (%) before recalculation.';
COMMENT ON COLUMN public.publication_metric_sync_logs.new_er IS
  'Engagement rate (%) after recalculation.';
COMMENT ON COLUMN public.publication_metric_sync_logs.previous_method IS
  'engagement_rate_method before recalculation (views, reach, followers, manual, unknown).';
COMMENT ON COLUMN public.publication_metric_sync_logs.new_method IS
  'engagement_rate_method after recalculation.';

CREATE INDEX IF NOT EXISTS publication_metric_sync_logs_er_audit_idx
  ON public.publication_metric_sync_logs (publication_id, created_at DESC)
  WHERE status = 'er_recalculated';
