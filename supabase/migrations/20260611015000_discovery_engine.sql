-- Thinkway Discovery Engine — public-signal influencer discovery (no paid APIs).
-- Workers write here; Next.js reads via RLS. Promote to influencers via influencer_id link.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'discovery_platform'
  ) THEN
    CREATE TYPE public.discovery_platform AS ENUM (
      'instagram', 'tiktok', 'youtube', 'twitter'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'discovery_profile_stage'
  ) THEN
    CREATE TYPE public.discovery_profile_stage AS ENUM (
      'discovered',
      'basic_enriched',
      'metrics_enriched',
      'ai_scored',
      'verified'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'discovery_method'
  ) THEN
    CREATE TYPE public.discovery_method AS ENUM (
      'hashtag', 'competitor', 'location', 'trend', 'manual'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'discovery_job_status'
  ) THEN
    CREATE TYPE public.discovery_job_status AS ENUM (
      'pending', 'running', 'completed', 'failed', 'cancelled'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'discovery_refresh_tier'
  ) THEN
    CREATE TYPE public.discovery_refresh_tier AS ENUM (
      'top', 'medium', 'inactive'
    );
  END IF;
END $$;

-- Permissions
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('discovery.read', 'discovery', 'read', 'View discovered influencer profiles and search'),
  ('discovery.write', 'discovery', 'write', 'Manage discovery jobs, lists, and profile promotion'),
  ('discovery.admin', 'discovery', 'admin', 'Run discovery crawlers and enrichment pipelines')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('super_admin', 'admin', 'account_manager', 'operations', 'finance')
  AND p.slug IN ('discovery.read', 'discovery.write', 'discovery.admin')
ON CONFLICT DO NOTHING;

-- Core profile registry (separate from influencers until promoted)
CREATE TABLE IF NOT EXISTS public.discovered_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform public.discovery_platform NOT NULL,
  username citext NOT NULL,
  profile_url text NOT NULL,
  display_name text,
  bio text,
  profile_image_url text,
  email_in_bio citext,
  country_code char(2),
  city text,
  language_codes text[] NOT NULL DEFAULT '{}',
  category_tags text[] NOT NULL DEFAULT '{}',
  stage public.discovery_profile_stage NOT NULL DEFAULT 'discovered',
  refresh_tier public.discovery_refresh_tier NOT NULL DEFAULT 'inactive',
  authenticity_score numeric(5, 2),
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL,
  search_vector tsvector,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_discovered_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_enriched_at timestamptz,
  next_refresh_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT discovered_profiles_platform_username_key UNIQUE (platform, username)
);

CREATE INDEX IF NOT EXISTS discovered_profiles_stage_idx
  ON public.discovered_profiles (stage);
CREATE INDEX IF NOT EXISTS discovered_profiles_platform_idx
  ON public.discovered_profiles (platform);
CREATE INDEX IF NOT EXISTS discovered_profiles_country_idx
  ON public.discovered_profiles (country_code)
  WHERE country_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS discovered_profiles_refresh_idx
  ON public.discovered_profiles (next_refresh_at)
  WHERE next_refresh_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS discovered_profiles_search_idx
  ON public.discovered_profiles USING gin (search_vector);
CREATE INDEX IF NOT EXISTS discovered_profiles_category_tags_idx
  ON public.discovered_profiles USING gin (category_tags);
CREATE INDEX IF NOT EXISTS discovered_profiles_influencer_id_idx
  ON public.discovered_profiles (influencer_id)
  WHERE influencer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.discovered_profiles_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.display_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.username::text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.bio, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.category_tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.city, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.country_code::text, '')), 'C');
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS discovered_profiles_search_vector_trg ON public.discovered_profiles;
CREATE TRIGGER discovered_profiles_search_vector_trg
  BEFORE INSERT OR UPDATE OF display_name, username, bio, category_tags, city, country_code
  ON public.discovered_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.discovered_profiles_search_vector_update();

-- Latest + historical metrics snapshots
CREATE TABLE IF NOT EXISTS public.profile_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.discovered_profiles (id) ON DELETE CASCADE,
  followers bigint NOT NULL DEFAULT 0,
  following bigint NOT NULL DEFAULT 0,
  posts_count integer NOT NULL DEFAULT 0,
  avg_likes numeric(14, 2),
  avg_comments numeric(14, 2),
  engagement_rate numeric(6, 3),
  avg_views bigint,
  posting_frequency_per_week numeric(6, 2),
  reels_views_avg bigint,
  captured_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  source text NOT NULL DEFAULT 'public_crawl',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS profile_metrics_profile_id_idx
  ON public.profile_metrics (profile_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.profile_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.discovered_profiles (id) ON DELETE CASCADE,
  platform_post_id text,
  post_url text,
  caption text,
  likes bigint NOT NULL DEFAULT 0,
  comments bigint NOT NULL DEFAULT 0,
  views bigint,
  hashtags text[] NOT NULL DEFAULT '{}',
  posted_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT profile_posts_profile_platform_post_key
    UNIQUE (profile_id, platform_post_id)
);

CREATE INDEX IF NOT EXISTS profile_posts_profile_id_idx
  ON public.profile_posts (profile_id, posted_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.profile_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.discovered_profiles (id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.profile_posts (id) ON DELETE SET NULL,
  engagement_type text NOT NULL,
  value numeric(14, 2) NOT NULL DEFAULT 0,
  sample_size integer NOT NULL DEFAULT 0,
  captured_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS profile_engagement_profile_id_idx
  ON public.profile_engagement (profile_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.profile_ai_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.discovered_profiles (id) ON DELETE CASCADE,
  category text,
  niche text,
  audience_type text,
  content_quality_score numeric(5, 2),
  luxury_level_score numeric(5, 2),
  brand_fit_score numeric(5, 2),
  professionalism_score numeric(5, 2),
  influencer_summary text,
  audience_persona text,
  content_style text,
  model_version text NOT NULL DEFAULT 'gpt-4o-mini',
  scored_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS profile_ai_scores_profile_id_idx
  ON public.profile_ai_scores (profile_id, scored_at DESC);

CREATE TABLE IF NOT EXISTS public.hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform public.discovery_platform NOT NULL,
  tag citext NOT NULL,
  post_count_estimate bigint,
  last_crawled_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT hashtags_platform_tag_key UNIQUE (platform, tag)
);

CREATE TABLE IF NOT EXISTS public.trend_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform public.discovery_platform NOT NULL DEFAULT 'tiktok',
  trend_type text NOT NULL,
  trend_key text NOT NULL,
  trend_label text,
  usage_count_estimate bigint,
  tracked_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT trend_tracking_platform_type_key_key
    UNIQUE (platform, trend_type, trend_key, tracked_at)
);

CREATE INDEX IF NOT EXISTS trend_tracking_platform_tracked_idx
  ON public.trend_tracking (platform, tracked_at DESC);

CREATE TABLE IF NOT EXISTS public.discovery_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.discovered_profiles (id) ON DELETE CASCADE,
  method public.discovery_method NOT NULL,
  source_ref text,
  hashtag_id uuid REFERENCES public.hashtags (id) ON DELETE SET NULL,
  trend_id uuid REFERENCES public.trend_tracking (id) ON DELETE SET NULL,
  discovered_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS discovery_sources_profile_id_idx
  ON public.discovery_sources (profile_id);
CREATE INDEX IF NOT EXISTS discovery_sources_method_idx
  ON public.discovery_sources (method, discovered_at DESC);

CREATE TABLE IF NOT EXISTS public.profile_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_profile_id uuid NOT NULL REFERENCES public.discovered_profiles (id) ON DELETE CASCADE,
  target_profile_id uuid NOT NULL REFERENCES public.discovered_profiles (id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  strength numeric(5, 2) NOT NULL DEFAULT 1,
  discovered_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT profile_relationships_unique
    UNIQUE (source_profile_id, target_profile_id, relationship_type),
  CONSTRAINT profile_relationships_no_self
    CHECK (source_profile_id <> target_profile_id)
);

CREATE INDEX IF NOT EXISTS profile_relationships_source_idx
  ON public.profile_relationships (source_profile_id);
CREATE INDEX IF NOT EXISTS profile_relationships_target_idx
  ON public.profile_relationships (target_profile_id);

-- Job audit trail (BullMQ jobs mirror here)
CREATE TABLE IF NOT EXISTS public.discovery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  method public.discovery_method,
  status public.discovery_job_status NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  profiles_discovered integer NOT NULL DEFAULT 0,
  profiles_enriched integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS discovery_jobs_status_idx
  ON public.discovery_jobs (status, created_at DESC);

-- Saved shortlists
CREATE TABLE IF NOT EXISTS public.discovery_shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.discovery_shortlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_id uuid NOT NULL REFERENCES public.discovery_shortlists (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.discovered_profiles (id) ON DELETE CASCADE,
  notes text,
  match_score numeric(5, 2),
  sort_order integer NOT NULL DEFAULT 0,
  added_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT discovery_shortlist_items_unique UNIQUE (shortlist_id, profile_id)
);

CREATE INDEX IF NOT EXISTS discovery_shortlist_items_shortlist_idx
  ON public.discovery_shortlist_items (shortlist_id, sort_order);

-- Campaign brief matching results
CREATE TABLE IF NOT EXISTS public.discovery_campaign_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  brief_text text NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.discovered_profiles (id) ON DELETE CASCADE,
  match_score numeric(5, 2) NOT NULL,
  predicted_performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS discovery_campaign_matches_campaign_idx
  ON public.discovery_campaign_matches (campaign_header_id, match_score DESC);

-- RLS
ALTER TABLE public.discovered_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_ai_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trend_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_shortlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_campaign_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discovered_profiles_select ON public.discovered_profiles;
CREATE POLICY discovered_profiles_select ON public.discovered_profiles
  FOR SELECT TO authenticated
  USING (public.has_permission('discovery.read') OR public.has_permission('influencers.read'));

DROP POLICY IF EXISTS discovered_profiles_write ON public.discovered_profiles;
CREATE POLICY discovered_profiles_write ON public.discovered_profiles
  FOR ALL TO authenticated
  USING (public.has_permission('discovery.write') OR public.has_permission('discovery.admin'))
  WITH CHECK (public.has_permission('discovery.write') OR public.has_permission('discovery.admin'));

DROP POLICY IF EXISTS discovery_shortlists_owner ON public.discovery_shortlists;
CREATE POLICY discovery_shortlists_owner ON public.discovery_shortlists
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_permission('discovery.admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_permission('discovery.admin'));

DROP POLICY IF EXISTS discovery_shortlists_select ON public.discovery_shortlists;
CREATE POLICY discovery_shortlists_select ON public.discovery_shortlists
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_permission('discovery.read')
    OR public.has_permission('discovery.admin')
  );

DROP POLICY IF EXISTS discovery_shortlist_items_access ON public.discovery_shortlist_items;
CREATE POLICY discovery_shortlist_items_access ON public.discovery_shortlist_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.discovery_shortlists s
      WHERE s.id = shortlist_id
        AND (s.owner_id = auth.uid() OR public.has_permission('discovery.admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.discovery_shortlists s
      WHERE s.id = shortlist_id
        AND (s.owner_id = auth.uid() OR public.has_permission('discovery.admin'))
    )
  );

-- Worker service role bypasses RLS; staff read child tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profile_metrics', 'profile_posts', 'profile_engagement', 'profile_ai_scores',
    'hashtags', 'trend_tracking', 'discovery_sources', 'profile_relationships',
    'discovery_jobs', 'discovery_campaign_matches'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (public.has_permission(''discovery.read'') OR public.has_permission(''influencers.read''))',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_write ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_write ON public.%I FOR ALL TO authenticated USING (public.has_permission(''discovery.admin'')) WITH CHECK (public.has_permission(''discovery.admin''))',
      t, t
    );
  END LOOP;
END $$;

-- Seed default discovery hashtags
INSERT INTO public.hashtags (platform, tag, is_active)
VALUES
  ('instagram', 'fashion', true),
  ('instagram', 'beauty', true),
  ('instagram', 'food', true),
  ('instagram', 'tech', true),
  ('instagram', 'travel', true),
  ('instagram', 'lifestyle', true),
  ('instagram', 'makeup', true),
  ('instagram', 'gaming', true),
  ('tiktok', 'fashion', true),
  ('tiktok', 'beauty', true),
  ('tiktok', 'gaming', true),
  ('youtube', 'tech', true),
  ('youtube', 'gaming', true),
  ('twitter', 'tech', true)
ON CONFLICT (platform, tag) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovered_profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_metrics TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_posts TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_engagement TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_ai_scores TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hashtags TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trend_tracking TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_sources TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_relationships TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_jobs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_shortlists TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_shortlist_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_campaign_matches TO authenticated, service_role;
