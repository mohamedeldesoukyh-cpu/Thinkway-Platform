-- Manual refresh execution trace + failure stage (Apify refresh stabilization).
-- Enables support soak evidence without inferring status from historical platform rows.

ALTER TABLE public.creator_enrichment_runs
  ADD COLUMN IF NOT EXISTS refresh_id uuid,
  ADD COLUMN IF NOT EXISTS failure_stage text,
  ADD COLUMN IF NOT EXISTS execution_trace jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS creator_enrichment_runs_refresh_id_idx
  ON public.creator_enrichment_runs (refresh_id)
  WHERE refresh_id IS NOT NULL;

COMMENT ON COLUMN public.creator_enrichment_runs.refresh_id IS
  'Stable id for one manual/worker refresh attempt (shared across running + terminal audit rows).';
COMMENT ON COLUMN public.creator_enrichment_runs.failure_stage IS
  'budget_verification | actor_launch | dataset_retrieval | snapshot_import | dna_enrichment | eci_generation | no_profile_changes | unknown';
COMMENT ON COLUMN public.creator_enrichment_runs.execution_trace IS
  'Full manual refresh execution trace (budget, actor, dataset, snapshot, DNA, ECI, duration).';
