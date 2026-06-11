-- Creator Browser ↔ Discovery integration: scores, confidence, indexes, shortlist helpers.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'metric_confidence_level'
  ) THEN
    CREATE TYPE public.metric_confidence_level AS ENUM (
      'estimated', 'inferred', 'verified', 'oauth_verified'
    );
  END IF;
END $$;

ALTER TABLE public.discovered_profiles
  ADD COLUMN IF NOT EXISTS thinkway_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS source_confidence numeric(5, 2),
  ADD COLUMN IF NOT EXISTS metric_confidence jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profile_metrics
  ADD COLUMN IF NOT EXISTS metric_confidence jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS thinkway_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS source_confidence numeric(5, 2),
  ADD COLUMN IF NOT EXISTS metric_confidence jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Composite browse indexes
CREATE INDEX IF NOT EXISTS discovered_profiles_browse_idx
  ON public.discovered_profiles (platform, country_code, stage, thinkway_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS discovered_profiles_language_idx
  ON public.discovered_profiles USING gin (language_codes);

CREATE INDEX IF NOT EXISTS profile_metrics_engagement_idx
  ON public.profile_metrics (profile_id, engagement_rate DESC NULLS LAST, captured_at DESC);

CREATE INDEX IF NOT EXISTS discovery_shortlists_campaign_idx
  ON public.discovery_shortlists (campaign_header_id)
  WHERE campaign_header_id IS NOT NULL;

-- Ensure one default campaign shortlist name uniqueness per campaign+owner is app-level
COMMENT ON COLUMN public.discovered_profiles.metric_confidence IS
  'Per-metric confidence map: followers, engagement_rate, avg_likes, avg_comments, avg_views';

-- Campaign shortlist: support internal vendors + discovered profiles
ALTER TABLE public.discovery_shortlist_items
  ADD COLUMN IF NOT EXISTS influencer_id uuid REFERENCES public.influencers (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS unified_id text;

ALTER TABLE public.discovery_shortlist_items
  ALTER COLUMN profile_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS discovery_shortlist_items_influencer_idx
  ON public.discovery_shortlist_items (influencer_id)
  WHERE influencer_id IS NOT NULL;

-- Replace strict unique with partial uniques
ALTER TABLE public.discovery_shortlist_items
  DROP CONSTRAINT IF EXISTS discovery_shortlist_items_unique;

CREATE UNIQUE INDEX IF NOT EXISTS discovery_shortlist_items_profile_unique
  ON public.discovery_shortlist_items (shortlist_id, profile_id)
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS discovery_shortlist_items_influencer_unique
  ON public.discovery_shortlist_items (shortlist_id, influencer_id)
  WHERE influencer_id IS NOT NULL;
