-- Full schema reconcile for campaign_publications (production-safe).
-- Adds legacy engagement_* columns AND Performance Center metrics when absent.

CREATE TABLE IF NOT EXISTS public.campaign_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL,
  platform text NOT NULL,
  publication_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.campaign_publications
  ADD COLUMN IF NOT EXISTS campaign_line_id uuid,
  ADD COLUMN IF NOT EXISTS assignment_deliverable_id uuid,
  ADD COLUMN IF NOT EXISTS assignment_post_schedule_id uuid,
  ADD COLUMN IF NOT EXISTS influencer_id uuid,
  ADD COLUMN IF NOT EXISTS content_url text,
  ADD COLUMN IF NOT EXISTS publication_date date,
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS hashtags text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS detected_by text,
  ADD COLUMN IF NOT EXISTS auto_detected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS detection_source text,
  ADD COLUMN IF NOT EXISTS external_media_id text,
  ADD COLUMN IF NOT EXISTS matched_hashtag text,
  ADD COLUMN IF NOT EXISTS api_sync_status text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS engagement_views bigint,
  ADD COLUMN IF NOT EXISTS engagement_likes bigint,
  ADD COLUMN IF NOT EXISTS engagement_comments bigint,
  ADD COLUMN IF NOT EXISTS engagement_shares bigint,
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

-- Backfill canonical metrics from legacy engagement_* when both exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaign_publications' AND column_name = 'engagement_views'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaign_publications' AND column_name = 'views'
  ) THEN
    UPDATE public.campaign_publications
    SET
      views = COALESCE(views, engagement_views),
      likes = COALESCE(likes, engagement_likes),
      comments = COALESCE(comments, engagement_comments),
      shares = COALESCE(shares, engagement_shares)
    WHERE views IS NULL OR likes IS NULL OR comments IS NULL OR shares IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS campaign_publications_campaign_header_id_idx
  ON public.campaign_publications (campaign_header_id);

CREATE INDEX IF NOT EXISTS campaign_publications_influencer_id_idx
  ON public.campaign_publications (influencer_id);

CREATE INDEX IF NOT EXISTS campaign_publications_status_idx
  ON public.campaign_publications (status);

CREATE INDEX IF NOT EXISTS campaign_publications_publication_date_idx
  ON public.campaign_publications (campaign_header_id, publication_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS campaign_publications_platform_idx
  ON public.campaign_publications (campaign_header_id, platform);

-- Schema introspection for app + verify:campaign-performance
CREATE OR REPLACE FUNCTION public.list_public_table_columns(p_table text)
RETURNS TABLE(column_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.column_name::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table
  ORDER BY c.ordinal_position;
$$;

REVOKE ALL ON FUNCTION public.list_public_table_columns(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_table_columns(text) TO authenticated, service_role;

-- RLS (idempotent)
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
