-- =============================================================================
-- Release 1.2 Phase 2 — Creator DNA extensions (additive only)
-- Cached completeness score + document section comments for new JSON sections.
-- Apply with: supabase db push (requires explicit operator approval)
-- =============================================================================

ALTER TABLE public.creator_dna
  ADD COLUMN IF NOT EXISTS dna_completeness_score smallint;

ALTER TABLE public.creator_dna_staging
  ADD COLUMN IF NOT EXISTS dna_completeness_score smallint;

COMMENT ON COLUMN public.creator_dna.dna_completeness_score IS
  'Cached 0..100 completeness from dna-completeness-engine (identity, platforms, audience, categories, content, commercial, quality, historicalPerformance).';

COMMENT ON COLUMN public.creator_dna_staging.dna_completeness_score IS
  'Cached staging completeness score before promotion to canonical creator_dna.';

COMMENT ON COLUMN public.creator_dna.document IS
  'Sectioned DNA document: identity, platforms, metrics, audience, contact, commercial, brandSafety, historicalPerformance, scores — each field wrapped in FieldEnvelope. Audience demographics (audienceGender, audienceAgeBands) require verified provider; never Apify-invented.';
