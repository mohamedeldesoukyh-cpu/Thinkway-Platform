-- =============================================================================
-- Sprint 1 — Creator DNA mandatory intelligence metadata (additive only)
-- Cached lifecycle + last intelligence update for refresh scheduling.
-- Apply with: supabase db push (requires explicit operator approval)
-- =============================================================================

ALTER TABLE public.creator_dna
  ADD COLUMN IF NOT EXISTS dna_lifecycle text,
  ADD COLUMN IF NOT EXISTS last_intelligence_update timestamptz;

COMMENT ON COLUMN public.creator_dna.dna_lifecycle IS
  'Cached creator maturity: IMPORTED, BASELINE, ENRICHED, ACTIVE, STRATEGIC, ARCHIVED. Mirrors document.meta.lifecycle.';

COMMENT ON COLUMN public.creator_dna.last_intelligence_update IS
  'When new intelligence was last merged into DNA — distinct from updated_at (operational edits).';

CREATE INDEX IF NOT EXISTS creator_dna_lifecycle_idx
  ON public.creator_dna (dna_lifecycle)
  WHERE dna_lifecycle IS NOT NULL;

CREATE INDEX IF NOT EXISTS creator_dna_last_intelligence_update_idx
  ON public.creator_dna (last_intelligence_update DESC)
  WHERE last_intelligence_update IS NOT NULL;
