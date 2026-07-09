-- =============================================================================
-- Release 1.2 — Persist full Apify enrichment payload on creator_dna rows
-- Apply with: supabase db push (requires explicit operator approval)
-- =============================================================================

ALTER TABLE public.creator_dna
  ADD COLUMN IF NOT EXISTS raw_apify_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS apify_run_id text;

ALTER TABLE public.creator_dna_staging
  ADD COLUMN IF NOT EXISTS raw_apify_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz,
  ADD COLUMN IF NOT EXISTS apify_run_id text;

CREATE INDEX IF NOT EXISTS creator_dna_enriched_at_idx
  ON public.creator_dna (enriched_at DESC)
  WHERE enriched_at IS NOT NULL;

COMMENT ON COLUMN public.creator_dna.raw_apify_snapshot IS
  'Immutable raw Apify actor payload (profileRows, postRows, run ids) from latest IPL snapshot merge.';

COMMENT ON COLUMN public.creator_dna.enriched_at IS
  'Timestamp of last Apify/IPL enrichment merged into this DNA row.';

COMMENT ON COLUMN public.creator_dna.apify_run_id IS
  'External Apify run id from the latest enrichment snapshot.';
