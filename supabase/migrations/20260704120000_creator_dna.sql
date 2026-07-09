-- =============================================================================
-- ERS-4 / Sprint 9.1 — Creator DNA (canonical creator intelligence layer)
--
-- One DNA record per influencer (PK = influencers.id).
-- Staging table for discovered_profiles pre-promotion.
-- Version history + IPL snapshot lineage — never overwrite history.
-- Apply with: supabase db push (requires explicit operator approval)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- creator_dna — canonical intelligence document keyed by influencers.id
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_dna (
  influencer_id uuid PRIMARY KEY REFERENCES public.influencers (id) ON DELETE CASCADE,
  document jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  last_snapshot_id uuid REFERENCES public.ipl_snapshots (id) ON DELETE SET NULL,
  last_enrichment_run_id uuid REFERENCES public.creator_enrichment_runs (id) ON DELETE SET NULL,
  platform_account_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS creator_dna_updated_at_idx
  ON public.creator_dna (updated_at DESC);
CREATE INDEX IF NOT EXISTS creator_dna_last_snapshot_idx
  ON public.creator_dna (last_snapshot_id)
  WHERE last_snapshot_id IS NOT NULL;

COMMENT ON TABLE public.creator_dna IS
  'Canonical creator intelligence keyed by influencers.id. Intelligent fields use FieldEnvelope shape in document jsonb.';
COMMENT ON COLUMN public.creator_dna.document IS
  'Sectioned DNA document: identity, metrics, audience, contact, scores — each field wrapped in { value, confidence, source, sourceVersion, updatedAt, history[] }.';

-- -----------------------------------------------------------------------------
-- creator_dna_staging — pre-promotion DNA for discovered_profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_dna_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovered_profile_id uuid NOT NULL REFERENCES public.discovered_profiles (id) ON DELETE CASCADE,
  document jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  last_snapshot_id uuid REFERENCES public.ipl_snapshots (id) ON DELETE SET NULL,
  platform_account_id uuid REFERENCES public.influencer_platform_accounts (id) ON DELETE SET NULL,
  promoted_to_influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL,
  promoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT creator_dna_staging_discovered_profile_key UNIQUE (discovered_profile_id)
);

CREATE INDEX IF NOT EXISTS creator_dna_staging_promoted_idx
  ON public.creator_dna_staging (promoted_to_influencer_id)
  WHERE promoted_to_influencer_id IS NOT NULL;

COMMENT ON TABLE public.creator_dna_staging IS
  'Staging DNA for discovered_profiles before promotion to influencers. Promoted rows merge into creator_dna.';

-- -----------------------------------------------------------------------------
-- creator_dna_versions — immutable version snapshots (never overwrite history)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_dna_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  version integer NOT NULL,
  document jsonb NOT NULL,
  change_reason text NOT NULL DEFAULT 'field_update',
  changed_fields text[] NOT NULL DEFAULT '{}'::text[],
  snapshot_id uuid REFERENCES public.ipl_snapshots (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT creator_dna_versions_influencer_version_key UNIQUE (influencer_id, version)
);

CREATE INDEX IF NOT EXISTS creator_dna_versions_influencer_idx
  ON public.creator_dna_versions (influencer_id, version DESC);

COMMENT ON TABLE public.creator_dna_versions IS
  'Append-only version history for creator_dna documents. Each merge/update inserts a new row.';

-- -----------------------------------------------------------------------------
-- creator_dna_lineage_events — audit trail linking DNA changes to IPL snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_dna_lineage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE CASCADE,
  discovered_profile_id uuid REFERENCES public.discovered_profiles (id) ON DELETE CASCADE,
  snapshot_id uuid REFERENCES public.ipl_snapshots (id) ON DELETE SET NULL,
  enrichment_run_id uuid REFERENCES public.creator_enrichment_runs (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  field_paths text[] NOT NULL DEFAULT '{}'::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT creator_dna_lineage_events_target_check CHECK (
    influencer_id IS NOT NULL OR discovered_profile_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS creator_dna_lineage_events_influencer_idx
  ON public.creator_dna_lineage_events (influencer_id, created_at DESC)
  WHERE influencer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS creator_dna_lineage_events_snapshot_idx
  ON public.creator_dna_lineage_events (snapshot_id)
  WHERE snapshot_id IS NOT NULL;

COMMENT ON TABLE public.creator_dna_lineage_events IS
  'Lineage audit: links DNA field updates to ipl_snapshots, enrichment runs, and reprocess jobs.';

-- Auto-bump updated_at on creator_dna
CREATE OR REPLACE FUNCTION public.creator_dna_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_dna_touch_updated_at_trg ON public.creator_dna;
CREATE TRIGGER creator_dna_touch_updated_at_trg
  BEFORE UPDATE ON public.creator_dna
  FOR EACH ROW
  EXECUTE FUNCTION public.creator_dna_touch_updated_at();

DROP TRIGGER IF EXISTS creator_dna_staging_touch_updated_at_trg ON public.creator_dna_staging;
CREATE TRIGGER creator_dna_staging_touch_updated_at_trg
  BEFORE UPDATE ON public.creator_dna_staging
  FOR EACH ROW
  EXECUTE FUNCTION public.creator_dna_touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.creator_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_dna_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_dna_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_dna_lineage_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_dna' AND policyname = 'creator_dna_read'
  ) THEN
    CREATE POLICY creator_dna_read ON public.creator_dna FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_dna_staging' AND policyname = 'creator_dna_staging_read'
  ) THEN
    CREATE POLICY creator_dna_staging_read ON public.creator_dna_staging FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_dna_versions' AND policyname = 'creator_dna_versions_read'
  ) THEN
    CREATE POLICY creator_dna_versions_read ON public.creator_dna_versions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'creator_dna_lineage_events' AND policyname = 'creator_dna_lineage_events_read'
  ) THEN
    CREATE POLICY creator_dna_lineage_events_read ON public.creator_dna_lineage_events FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
