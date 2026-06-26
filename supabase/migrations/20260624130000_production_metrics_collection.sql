-- Production metrics collection: provider confidence, scheduling, enhanced sync logs.

ALTER TABLE public.campaign_publications
  ADD COLUMN IF NOT EXISTS metrics_provider text,
  ADD COLUMN IF NOT EXISTS metrics_confidence integer,
  ADD COLUMN IF NOT EXISTS metrics_next_refresh_at timestamptz;

COMMENT ON COLUMN public.campaign_publications.metrics_refresh_status IS
  'queued | pending | collecting | completed | partial | manual_required | failed';

CREATE INDEX IF NOT EXISTS campaign_publications_metrics_next_refresh_idx
  ON public.campaign_publications (metrics_next_refresh_at)
  WHERE metrics_next_refresh_at IS NOT NULL
    AND metrics_refresh_status NOT IN ('collecting', 'manual_required');

CREATE INDEX IF NOT EXISTS campaign_publications_metrics_queued_idx
  ON public.campaign_publications (updated_at)
  WHERE metrics_refresh_status = 'queued';

ALTER TABLE public.publication_metric_sync_logs
  ADD COLUMN IF NOT EXISTS request_payload jsonb,
  ADD COLUMN IF NOT EXISTS response_summary jsonb,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS error text;
