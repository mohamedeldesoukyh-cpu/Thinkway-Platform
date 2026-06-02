-- Master-data platform deliverable taxonomy + campaign publication tracking.

CREATE TABLE IF NOT EXISTS public.md_platform_deliverable_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT md_platform_deliverable_types_platform_code_unique UNIQUE (platform, code)
);

CREATE INDEX IF NOT EXISTS md_platform_deliverable_types_platform_idx
  ON public.md_platform_deliverable_types (platform, sort_order);

INSERT INTO public.md_platform_deliverable_types (platform, code, name, short_name, sort_order)
VALUES
  ('instagram', 'instagram_post', 'Instagram post', 'IG Post', 1),
  ('instagram', 'instagram_reel', 'Instagram reel', 'IG Reel', 2),
  ('instagram', 'instagram_story', 'Instagram story', 'IG Story', 3),
  ('instagram', 'instagram_live', 'Instagram live', 'IG Live', 4),
  ('tiktok', 'tiktok_video', 'TikTok video', 'TT Video', 1),
  ('tiktok', 'tiktok_story', 'TikTok story', 'TT Story', 2),
  ('tiktok', 'tiktok_live', 'TikTok live', 'TT Live', 3),
  ('snapchat', 'snapchat_story', 'Snapchat story', 'SC Story', 1),
  ('snapchat', 'snapchat_spotlight', 'Snapchat Spotlight', 'SC Spotlight', 2),
  ('youtube', 'youtube_video', 'YouTube integration', 'YT Integration', 1),
  ('youtube', 'youtube_short', 'YouTube short', 'YT Short', 2),
  ('youtube', 'youtube_dedicated', 'YouTube dedicated', 'YT Dedicated', 3)
ON CONFLICT (platform, code) DO UPDATE SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = timezone('utc', now());

CREATE TABLE IF NOT EXISTS public.campaign_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  campaign_line_id uuid REFERENCES public.campaign_lines (id) ON DELETE SET NULL,
  assignment_deliverable_id uuid REFERENCES public.assignment_deliverables (id) ON DELETE SET NULL,
  assignment_post_schedule_id uuid REFERENCES public.assignment_post_schedule (id) ON DELETE SET NULL,
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL,
  platform text NOT NULL,
  publication_type text NOT NULL,
  content_url text,
  publication_date date,
  status text NOT NULL DEFAULT 'draft',
  assignee_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  caption text,
  hashtags text,
  notes text,
  detected_by text,
  auto_detected boolean NOT NULL DEFAULT false,
  detection_source text,
  external_media_id text,
  matched_hashtag text,
  api_sync_status text,
  last_synced_at timestamptz,
  engagement_views bigint,
  engagement_likes bigint,
  engagement_comments bigint,
  engagement_shares bigint,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS campaign_publications_campaign_header_id_idx
  ON public.campaign_publications (campaign_header_id);

CREATE INDEX IF NOT EXISTS campaign_publications_influencer_id_idx
  ON public.campaign_publications (influencer_id);

CREATE INDEX IF NOT EXISTS campaign_publications_status_idx
  ON public.campaign_publications (status);

DROP TRIGGER IF EXISTS set_campaign_publications_updated_at ON public.campaign_publications;
CREATE TRIGGER set_campaign_publications_updated_at
  BEFORE UPDATE ON public.campaign_publications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_md_platform_deliverable_types_updated_at ON public.md_platform_deliverable_types;
CREATE TRIGGER set_md_platform_deliverable_types_updated_at
  BEFORE UPDATE ON public.md_platform_deliverable_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
