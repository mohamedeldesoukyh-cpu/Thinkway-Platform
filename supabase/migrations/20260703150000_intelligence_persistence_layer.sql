-- =============================================================================
-- Sprint 8.5 — Intelligence Persistence Layer (IPL)
--
-- Additive foundation for permanent storage of external enrichment data.
-- Raw snapshots are immutable; each fetch creates a new version row.
-- Apply with: supabase db push (requires explicit operator approval)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'ipl_provider_run_status'
  ) THEN
    CREATE TYPE public.ipl_provider_run_status AS ENUM (
      'pending',
      'running',
      'completed',
      'failed',
      'cached'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'ipl_reprocess_status'
  ) THEN
    CREATE TYPE public.ipl_reprocess_status AS ENUM (
      'queued',
      'running',
      'completed',
      'failed',
      'skipped'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- ipl_refresh_policies — configurable TTL per provider / field group
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ipl_refresh_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  field_group text NOT NULL,
  ttl_days integer NOT NULL CHECK (ttl_days > 0),
  follower_tier_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT ipl_refresh_policies_provider_field_group_key UNIQUE (provider, field_group)
);

COMMENT ON TABLE public.ipl_refresh_policies IS
  'Cache TTL rules for IPL. field_group: profile|metrics|content|contact|all.';
COMMENT ON COLUMN public.ipl_refresh_policies.follower_tier_overrides IS
  'Optional jsonb map { "500000": 7, "50000": 14 } — shorter TTL for high-reach creators.';

-- Default policies aligned with creator-enrichment 30-day freshness window.
INSERT INTO public.ipl_refresh_policies (provider, field_group, ttl_days, follower_tier_overrides, notes)
VALUES
  ('apify', 'all', 30, '{"500000": 7, "50000": 14}'::jsonb, 'Default Apify profile cache'),
  ('apify', 'profile', 30, '{}'::jsonb, 'Display name, bio, avatar'),
  ('apify', 'metrics', 30, '{"500000": 7, "50000": 14}'::jsonb, 'Followers, engagement, averages'),
  ('apify', 'content', 14, '{}'::jsonb, 'Posts, hashtags, mentions'),
  ('apify', 'contact', 30, '{}'::jsonb, 'Email, phone, links')
ON CONFLICT (provider, field_group) DO NOTHING;

-- -----------------------------------------------------------------------------
-- ipl_provider_runs — metadata for every external provider call
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ipl_provider_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_run_id text,
  status public.ipl_provider_run_status NOT NULL DEFAULT 'pending',
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL,
  platform_account_id uuid REFERENCES public.influencer_platform_accounts (id) ON DELETE SET NULL,
  discovered_profile_id uuid REFERENCES public.discovered_profiles (id) ON DELETE SET NULL,
  platform text,
  profile_url text,
  credits_used numeric(12, 4),
  duration_ms integer,
  estimated_cost_usd numeric(12, 6),
  payload_bytes integer,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS ipl_provider_runs_influencer_idx
  ON public.ipl_provider_runs (influencer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ipl_provider_runs_platform_account_idx
  ON public.ipl_provider_runs (platform_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ipl_provider_runs_provider_status_idx
  ON public.ipl_provider_runs (provider, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ipl_provider_runs_external_run_idx
  ON public.ipl_provider_runs (provider, external_run_id)
  WHERE external_run_id IS NOT NULL;

COMMENT ON TABLE public.ipl_provider_runs IS
  'Audit metadata for each external enrichment provider invocation (Apify, future Modash, etc.).';

-- -----------------------------------------------------------------------------
-- ipl_snapshots — immutable raw + normalized versioned snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ipl_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_run_id uuid REFERENCES public.ipl_provider_runs (id) ON DELETE SET NULL,
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL,
  platform_account_id uuid REFERENCES public.influencer_platform_accounts (id) ON DELETE SET NULL,
  discovered_profile_id uuid REFERENCES public.discovered_profiles (id) ON DELETE SET NULL,
  provider text NOT NULL,
  platform text NOT NULL,
  profile_url text,
  snapshot_version integer NOT NULL DEFAULT 1,
  raw_snapshot jsonb NOT NULL,
  normalized_snapshot jsonb NOT NULL,
  snapshot_type text NOT NULL DEFAULT 'profile',
  fetched_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz,
  is_latest boolean NOT NULL DEFAULT true,
  audit_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT ipl_snapshots_raw_immutable CHECK (raw_snapshot IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS ipl_snapshots_latest_lookup_idx
  ON public.ipl_snapshots (provider, platform, platform_account_id, is_latest)
  WHERE is_latest = true AND platform_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ipl_snapshots_influencer_latest_idx
  ON public.ipl_snapshots (influencer_id, provider, is_latest, fetched_at DESC)
  WHERE is_latest = true;
CREATE INDEX IF NOT EXISTS ipl_snapshots_discovered_profile_idx
  ON public.ipl_snapshots (discovered_profile_id, fetched_at DESC)
  WHERE discovered_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ipl_snapshots_version_idx
  ON public.ipl_snapshots (platform_account_id, provider, snapshot_version DESC)
  WHERE platform_account_id IS NOT NULL;

COMMENT ON TABLE public.ipl_snapshots IS
  'Immutable versioned snapshots. raw_snapshot is never updated in place; each fetch inserts a new row.';
COMMENT ON COLUMN public.ipl_snapshots.normalized_snapshot IS
  'Provider-agnostic normalized profile shape after adapter processing.';
COMMENT ON COLUMN public.ipl_snapshots.audit_metadata IS
  'Trigger, job_id, requested_by, enrichment_run_id, cache_hit, etc.';

-- Mark previous snapshots as not latest when a new one is inserted for same scope.
CREATE OR REPLACE FUNCTION public.ipl_snapshots_mark_previous_not_latest()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_latest = true AND NEW.platform_account_id IS NOT NULL THEN
    UPDATE public.ipl_snapshots
    SET is_latest = false
    WHERE platform_account_id = NEW.platform_account_id
      AND provider = NEW.provider
      AND id <> NEW.id
      AND is_latest = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ipl_snapshots_mark_previous_not_latest_trg ON public.ipl_snapshots;
CREATE TRIGGER ipl_snapshots_mark_previous_not_latest_trg
  AFTER INSERT ON public.ipl_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.ipl_snapshots_mark_previous_not_latest();

-- Auto-increment snapshot_version per platform_account + provider.
CREATE OR REPLACE FUNCTION public.ipl_snapshots_assign_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_version integer;
BEGIN
  IF NEW.platform_account_id IS NOT NULL THEN
    SELECT COALESCE(MAX(snapshot_version), 0) + 1
    INTO next_version
    FROM public.ipl_snapshots
    WHERE platform_account_id = NEW.platform_account_id
      AND provider = NEW.provider;
    NEW.snapshot_version := next_version;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ipl_snapshots_assign_version_trg ON public.ipl_snapshots;
CREATE TRIGGER ipl_snapshots_assign_version_trg
  BEFORE INSERT ON public.ipl_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.ipl_snapshots_assign_version();

-- -----------------------------------------------------------------------------
-- ipl_reprocess_jobs — regenerate AI classifications from stored snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ipl_reprocess_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.ipl_snapshots (id) ON DELETE CASCADE,
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL,
  platform_account_id uuid REFERENCES public.influencer_platform_accounts (id) ON DELETE SET NULL,
  job_type text NOT NULL,
  status public.ipl_reprocess_status NOT NULL DEFAULT 'queued',
  input_snapshot_version integer,
  output_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  requested_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS ipl_reprocess_jobs_status_idx
  ON public.ipl_reprocess_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ipl_reprocess_jobs_snapshot_idx
  ON public.ipl_reprocess_jobs (snapshot_id, created_at DESC);

COMMENT ON TABLE public.ipl_reprocess_jobs IS
  'Reprocessing pipeline: run category-inference and future AI classifiers from stored normalized snapshots without external calls.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.ipl_refresh_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_provider_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_reprocess_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ipl_refresh_policies' AND policyname = 'ipl_refresh_policies_read'
  ) THEN
    CREATE POLICY ipl_refresh_policies_read ON public.ipl_refresh_policies FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ipl_provider_runs' AND policyname = 'ipl_provider_runs_read'
  ) THEN
    CREATE POLICY ipl_provider_runs_read ON public.ipl_provider_runs FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ipl_snapshots' AND policyname = 'ipl_snapshots_read'
  ) THEN
    CREATE POLICY ipl_snapshots_read ON public.ipl_snapshots FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ipl_reprocess_jobs' AND policyname = 'ipl_reprocess_jobs_read'
  ) THEN
    CREATE POLICY ipl_reprocess_jobs_read ON public.ipl_reprocess_jobs FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
