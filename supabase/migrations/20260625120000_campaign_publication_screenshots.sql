-- Publication screenshot capture + sync audit for Campaign Performance reports.

ALTER TABLE public.campaign_publications
  ADD COLUMN IF NOT EXISTS screenshot_url text,
  ADD COLUMN IF NOT EXISTS screenshot_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS screenshot_source text;

COMMENT ON COLUMN public.campaign_publications.thumbnail_url IS
  'Preview thumbnail — provider URL or storage path in campaign-publication-media bucket.';
COMMENT ON COLUMN public.campaign_publications.screenshot_url IS
  'Full post preview capture — storage path in campaign-publication-media bucket.';
COMMENT ON COLUMN public.campaign_publications.screenshot_source IS
  'meta_graph_thumbnail | apify | opengraph | playwright | youtube_thumbnail_api | tiktok_oembed';

CREATE INDEX IF NOT EXISTS campaign_publications_screenshot_pending_idx
  ON public.campaign_publications (updated_at)
  WHERE screenshot_url IS NULL
    AND content_url IS NOT NULL
    AND metrics_refresh_status IN ('completed', 'partial');

CREATE TABLE IF NOT EXISTS public.publication_screenshot_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.campaign_publications (id) ON DELETE CASCADE,
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  status text NOT NULL,
  source text,
  attempt_order integer NOT NULL DEFAULT 1,
  message text,
  error_code text,
  error text,
  triggered_by text NOT NULL DEFAULT 'system',
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS publication_screenshot_sync_logs_publication_idx
  ON public.publication_screenshot_sync_logs (publication_id, created_at DESC);

CREATE INDEX IF NOT EXISTS publication_screenshot_sync_logs_campaign_idx
  ON public.publication_screenshot_sync_logs (campaign_header_id, created_at DESC);

ALTER TABLE public.publication_screenshot_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY publication_screenshot_sync_logs_select ON public.publication_screenshot_sync_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaign_headers h
      WHERE h.id = publication_screenshot_sync_logs.campaign_header_id
    )
  );

CREATE POLICY publication_screenshot_sync_logs_service ON public.publication_screenshot_sync_logs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-publication-media',
  'campaign-publication-media',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY campaign_publication_media_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-publication-media');

CREATE POLICY campaign_publication_media_insert ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'campaign-publication-media');

CREATE POLICY campaign_publication_media_update ON storage.objects
  FOR UPDATE TO service_role
  USING (bucket_id = 'campaign-publication-media');
