-- Campaign Metrics Collection Engine: refresh status, engagements, sync logs.

ALTER TABLE public.campaign_publications
  ADD COLUMN IF NOT EXISTS metrics_refresh_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS metrics_refresh_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS metrics_collection_source text,
  ADD COLUMN IF NOT EXISTS engagements bigint;

COMMENT ON COLUMN public.campaign_publications.metrics_refresh_status IS
  'pending | collecting | completed | manual_required | failed';

CREATE INDEX IF NOT EXISTS campaign_publications_metrics_refresh_status_idx
  ON public.campaign_publications (campaign_header_id, metrics_refresh_status);

CREATE INDEX IF NOT EXISTS campaign_publications_metrics_refresh_due_idx
  ON public.campaign_publications (metrics_refresh_attempted_at NULLS FIRST)
  WHERE metrics_refresh_status IN ('pending', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS public.publication_metric_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.campaign_publications (id) ON DELETE CASCADE,
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  status text NOT NULL,
  metrics_refresh_status text,
  provider text NOT NULL,
  attempt_order integer NOT NULL DEFAULT 0,
  message text,
  error_code text,
  metrics_snapshot jsonb,
  triggered_by text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS publication_metric_sync_logs_publication_idx
  ON public.publication_metric_sync_logs (publication_id, created_at DESC);

CREATE INDEX IF NOT EXISTS publication_metric_sync_logs_campaign_idx
  ON public.publication_metric_sync_logs (campaign_header_id, created_at DESC);

ALTER TABLE public.publication_metric_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS publication_metric_sync_logs_select ON public.publication_metric_sync_logs;
CREATE POLICY publication_metric_sync_logs_select ON public.publication_metric_sync_logs
  FOR SELECT TO authenticated
  USING (public.can_access_campaign_header(campaign_header_id));

DROP POLICY IF EXISTS publication_metric_sync_logs_write ON public.publication_metric_sync_logs;
CREATE POLICY publication_metric_sync_logs_write ON public.publication_metric_sync_logs
  FOR ALL TO authenticated
  USING (public.can_access_campaign_header(campaign_header_id))
  WITH CHECK (public.can_access_campaign_header(campaign_header_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publication_metric_sync_logs TO authenticated, service_role;
