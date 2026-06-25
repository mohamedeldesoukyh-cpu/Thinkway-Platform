-- =============================================================================
-- Phase 3 — Production creator enrichment (Apify) across Discovery & Shortlists.
--
-- Idempotent & additive. Safe to re-run. NOT auto-applied.
-- Apply with:  supabase db push   (requires explicit operator approval)
-- After applying, restart the discovery worker so the new `creator-enrichment`
-- queue + worker are picked up:  npm run discovery:worker
--
-- TABLE PLACEMENT RATIONALE
-- -------------------------
-- * public.influencers  -> per-CREATOR enrichment orchestration state
--   (last_enriched_at, enrichment_status, enrichment_source, enrichment_priority,
--    next_refresh_at, apify_run_id, profile_data_version, demographic_source) plus
--   AUDIENCE DEMOGRAPHICS. Demographics + their source live on the creator because
--   the Creator Detail UI is creator-level and providers (Modash / HypeAuditor /
--   CreatorIQ) describe the creator's audience. Stored NULL until a real provider
--   supplies them; demographic_source = 'unavailable' when we have nothing.
--
-- * public.influencer_platform_accounts -> per-PLATFORM enriched FIELDS
--   (posts_count, avg_views/likes/comments, recent_publications, hashtags,
--    mentions, categories, public contact info) plus per-account enrichment state.
--   Followers / following / engagement_rate / bio / avatar / verified already
--   exist here (creator_profile_enrichment + creator_avatar_sync migrations).
--
-- TRANSPARENCY / MANUAL PROTECTION
-- --------------------------------
-- `field_sources` (jsonb) on both tables is a per-field source map:
--   { "<field>": "actual" | "forecast" | "manual" | "imported" | "apify" }
-- Merge logic never overwrites a field whose source is 'manual'.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'creator_enrichment_status'
  ) THEN
    CREATE TYPE public.creator_enrichment_status AS ENUM (
      'never',      -- imported / created, never enriched (DEFAULT)
      'queued',     -- job enqueued, not yet running
      'running',    -- worker is processing
      'enriched',   -- last run succeeded
      'partial',    -- last run returned some but not all fields
      'failed',     -- last run failed (after retries -> dead-letter)
      'skipped'     -- fresh within 30 days, no work performed
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'creator_demographic_source'
  ) THEN
    CREATE TYPE public.creator_demographic_source AS ENUM (
      'unavailable',  -- DEFAULT — no audience data, never invented
      'modash',
      'hypeauditor',
      'creatoriq',
      'apify',
      'manual'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- influencers — per-creator enrichment orchestration + audience demographics
-- -----------------------------------------------------------------------------
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_status public.creator_enrichment_status NOT NULL DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS enrichment_source text,
  ADD COLUMN IF NOT EXISTS enrichment_priority smallint,
  ADD COLUMN IF NOT EXISTS next_refresh_at timestamptz,
  ADD COLUMN IF NOT EXISTS apify_run_id text,
  ADD COLUMN IF NOT EXISTS profile_data_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Audience demographics — NULL until a real provider supplies them. Never estimated.
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS audience_age_13_17 numeric(5,2),
  ADD COLUMN IF NOT EXISTS audience_age_18_24 numeric(5,2),
  ADD COLUMN IF NOT EXISTS audience_age_25_34 numeric(5,2),
  ADD COLUMN IF NOT EXISTS audience_age_35_44 numeric(5,2),
  ADD COLUMN IF NOT EXISTS audience_age_45_54 numeric(5,2),
  ADD COLUMN IF NOT EXISTS audience_age_55_plus numeric(5,2),
  ADD COLUMN IF NOT EXISTS audience_gender_male numeric(5,2),
  ADD COLUMN IF NOT EXISTS audience_gender_female numeric(5,2),
  ADD COLUMN IF NOT EXISTS audience_gender_unknown numeric(5,2),
  -- Flexible-but-typed: ordered arrays of { code/name, percent } objects so new
  -- providers can populate WITHOUT schema changes.
  ADD COLUMN IF NOT EXISTS audience_top_countries jsonb,
  ADD COLUMN IF NOT EXISTS audience_top_cities jsonb,
  ADD COLUMN IF NOT EXISTS demographic_source public.creator_demographic_source NOT NULL DEFAULT 'unavailable';

COMMENT ON COLUMN public.influencers.enrichment_priority IS
  '1=campaign (HIGH), 2=shortlist, 3=detail view, 4=manual refresh.';
COMMENT ON COLUMN public.influencers.field_sources IS
  'Per-field source map { field: actual|forecast|manual|imported|apify }. Fields tagged manual are never auto-overwritten.';
COMMENT ON COLUMN public.influencers.audience_top_countries IS
  'Ordered jsonb array [{ code, name, percent }]; NULL when unavailable. Populatable by Modash/HypeAuditor/CreatorIQ without schema change.';
COMMENT ON COLUMN public.influencers.demographic_source IS
  'Origin of audience demographics; ''unavailable'' when none. NEVER estimate/invent demographics.';

CREATE INDEX IF NOT EXISTS influencers_enrichment_status_idx
  ON public.influencers (enrichment_status);
CREATE INDEX IF NOT EXISTS influencers_next_refresh_at_idx
  ON public.influencers (next_refresh_at)
  WHERE next_refresh_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- influencer_platform_accounts — per-platform enriched fields + state
-- -----------------------------------------------------------------------------
ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS posts_count bigint,
  ADD COLUMN IF NOT EXISTS avg_likes numeric(14,2),
  ADD COLUMN IF NOT EXISTS avg_comments numeric(14,2),
  -- avg_views already exists (platform_metrics_tracking migration) — not re-added here.
  ADD COLUMN IF NOT EXISTS recent_publications jsonb,
  ADD COLUMN IF NOT EXISTS hashtags text[],
  ADD COLUMN IF NOT EXISTS mentions text[],
  ADD COLUMN IF NOT EXISTS interest_categories text[],
  ADD COLUMN IF NOT EXISTS contact_email citext,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_links jsonb,
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_status public.creator_enrichment_status NOT NULL DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS apify_run_id text,
  ADD COLUMN IF NOT EXISTS profile_data_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS field_sources jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.influencer_platform_accounts.field_sources IS
  'Per-field source map { field: actual|forecast|manual|imported|apify }. Manual fields never auto-overwritten by enrichment.';
COMMENT ON COLUMN public.influencer_platform_accounts.recent_publications IS
  'Ordered jsonb array of recent posts [{ url, thumbnail, likes, comments, views, posted_at, caption }]; NULL when unavailable.';

CREATE INDEX IF NOT EXISTS ipa_enrichment_status_idx
  ON public.influencer_platform_accounts (enrichment_status);

-- -----------------------------------------------------------------------------
-- creator_enrichment_runs — audit log + dead-letter visibility for every run
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_enrichment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE CASCADE,
  platform_account_id uuid REFERENCES public.influencer_platform_accounts (id) ON DELETE SET NULL,
  discovered_profile_id uuid REFERENCES public.discovered_profiles (id) ON DELETE SET NULL,
  trigger text NOT NULL,                       -- campaign | shortlist | detail | manual | stale
  priority smallint NOT NULL,                  -- 1..4
  status text NOT NULL DEFAULT 'queued',       -- queued|running|completed|partial|skipped|failed|dead_letter
  source text,                                 -- apify | open_graph | ...
  apify_run_id text,
  forced boolean NOT NULL DEFAULT false,       -- explicit Refresh bypasses 30-day skip
  skipped_reason text,
  fields_updated text[] NOT NULL DEFAULT '{}',
  attempt integer NOT NULL DEFAULT 1,
  error_message text,
  job_id text,
  requested_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS creator_enrichment_runs_influencer_idx
  ON public.creator_enrichment_runs (influencer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS creator_enrichment_runs_status_idx
  ON public.creator_enrichment_runs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS creator_enrichment_runs_dead_letter_idx
  ON public.creator_enrichment_runs (created_at DESC)
  WHERE status = 'dead_letter';

ALTER TABLE public.creator_enrichment_runs ENABLE ROW LEVEL SECURITY;

-- Service role (worker) bypasses RLS. Authenticated staff may read run history.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'creator_enrichment_runs'
      AND policyname = 'creator_enrichment_runs_read'
  ) THEN
    CREATE POLICY creator_enrichment_runs_read
      ON public.creator_enrichment_runs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
