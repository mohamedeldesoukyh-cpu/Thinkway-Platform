-- Campaign Performance Center: extend campaign_publications with full metrics model.

ALTER TABLE public.campaign_publications
  ADD COLUMN IF NOT EXISTS mentions text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS impressions bigint,
  ADD COLUMN IF NOT EXISTS reach bigint,
  ADD COLUMN IF NOT EXISTS views bigint,
  ADD COLUMN IF NOT EXISTS unique_views bigint,
  ADD COLUMN IF NOT EXISTS likes bigint,
  ADD COLUMN IF NOT EXISTS comments bigint,
  ADD COLUMN IF NOT EXISTS shares bigint,
  ADD COLUMN IF NOT EXISTS saves bigint,
  ADD COLUMN IF NOT EXISTS clicks bigint,
  ADD COLUMN IF NOT EXISTS plays bigint,
  ADD COLUMN IF NOT EXISTS watch_time_seconds bigint,
  ADD COLUMN IF NOT EXISTS average_watch_time_seconds numeric(12, 2),
  ADD COLUMN IF NOT EXISTS completion_rate numeric(8, 4),
  ADD COLUMN IF NOT EXISTS engagement_rate numeric(8, 4),
  ADD COLUMN IF NOT EXISTS view_rate numeric(8, 4),
  ADD COLUMN IF NOT EXISTS cpm numeric(14, 4),
  ADD COLUMN IF NOT EXISTS cpv numeric(14, 4),
  ADD COLUMN IF NOT EXISTS cpe numeric(14, 4),
  ADD COLUMN IF NOT EXISTS cpc numeric(14, 4),
  ADD COLUMN IF NOT EXISTS sentiment_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS brand_safety_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS authenticity_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS cost numeric(14, 2),
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS sync_status text,
  ADD COLUMN IF NOT EXISTS sync_source text;

-- Backfill from legacy engagement_* columns when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'campaign_publications'
      AND column_name = 'engagement_views'
  ) THEN
    UPDATE public.campaign_publications
    SET
      views = COALESCE(views, engagement_views),
      likes = COALESCE(likes, engagement_likes),
      comments = COALESCE(comments, engagement_comments),
      shares = COALESCE(shares, engagement_shares);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'campaign_publications'
      AND column_name = 'api_sync_status'
  ) THEN
    UPDATE public.campaign_publications
    SET sync_status = COALESCE(sync_status, api_sync_status)
    WHERE sync_status IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'campaign_publications'
      AND column_name = 'detection_source'
  ) THEN
    UPDATE public.campaign_publications
    SET sync_source = COALESCE(sync_source, detection_source)
    WHERE sync_source IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS campaign_publications_publication_date_idx
  ON public.campaign_publications (campaign_header_id, publication_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS campaign_publications_platform_idx
  ON public.campaign_publications (campaign_header_id, platform);

-- RLS (mirror assignment_deliverables)
ALTER TABLE public.campaign_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_publications_select ON public.campaign_publications;
CREATE POLICY campaign_publications_select ON public.campaign_publications
  FOR SELECT TO authenticated
  USING (public.can_access_campaign_header(campaign_header_id));

DROP POLICY IF EXISTS campaign_publications_write ON public.campaign_publications;
CREATE POLICY campaign_publications_write ON public.campaign_publications
  FOR ALL TO authenticated
  USING (public.can_access_campaign_header(campaign_header_id))
  WITH CHECK (public.can_access_campaign_header(campaign_header_id));
