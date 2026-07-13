-- Creator Intelligence projection (Phase H) — persisted, indexed snapshot of the
-- resolved semantic profile so SQL predicates can filter on INTELLIGENCE
-- instead of provenance columns. Values are stored pre-normalized (canonical
-- category labels, ISO codes, lowercase tiers preserved as canonical labels)
-- so predicates stay index-friendly — never wrap columns in lower().
--
-- Additive: nothing reads this table until CREATOR_INTELLIGENCE_MODE cutover;
-- populated by scripts/backfill-creator-intelligence.ts and (going forward)
-- enrichment writes. See docs/CREATOR_INTELLIGENCE_ARCHITECTURE.md.

CREATE TABLE IF NOT EXISTS public.creator_intelligence (
  unified_id text PRIMARY KEY,
  source_type text NOT NULL,
  display_name text,
  platforms text[] NOT NULL DEFAULT '{}',
  categories text[] NOT NULL DEFAULT '{}',
  category_source text NOT NULL DEFAULT 'unresolved',
  category_confidence numeric NOT NULL DEFAULT 0,
  niche text,
  topics text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  creator_tier text,
  audience_countries text[] NOT NULL DEFAULT '{}',
  audience_age_bucket text,
  audience_gender_male numeric,
  audience_gender_female numeric,
  brand_safety_level text NOT NULL DEFAULT 'unknown',
  max_followers bigint,
  max_engagement_rate numeric,
  thinkway_score numeric,
  resolved_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS creator_intelligence_categories_idx
  ON public.creator_intelligence USING gin (categories);
CREATE INDEX IF NOT EXISTS creator_intelligence_platforms_idx
  ON public.creator_intelligence USING gin (platforms);
CREATE INDEX IF NOT EXISTS creator_intelligence_audience_countries_idx
  ON public.creator_intelligence USING gin (audience_countries);
CREATE INDEX IF NOT EXISTS creator_intelligence_tier_idx
  ON public.creator_intelligence (creator_tier);

ALTER TABLE public.creator_intelligence ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'creator_intelligence'
      AND policyname = 'creator_intelligence_read'
  ) THEN
    CREATE POLICY creator_intelligence_read ON public.creator_intelligence
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
