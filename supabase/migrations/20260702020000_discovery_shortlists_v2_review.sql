-- =============================================================================
-- Discovery Shortlist Architecture V2 — production review hardening (separable)
-- -----------------------------------------------------------------------------
-- Item 8: Duplicate protection for shortlist-sourced campaign assignments.
--
-- IMPORTANT: a plain UNIQUE(campaign_header_id, influencer_id) would BREAK
-- legitimate existing vendor flows, where the SAME influencer can be assigned to
-- MULTIPLE campaign lines of one campaign (the existing constraint is per-line:
-- campaign_influencers_unique UNIQUE (campaign_header_id, campaign_line_id, influencer_id)).
--
-- So we scope duplicate protection to shortlist-originated rows via a PARTIAL
-- unique index `WHERE shortlist_assignment_status IS NOT NULL`. This guarantees at
-- most one shortlist "Suggested/Invited/..." row per (campaign, creator) without
-- touching line-level vendor assignments. Matches the move-to-campaign reconcile
-- logic (one shortlist row per campaign+influencer).
--
-- Additive + idempotent. Not auto-applied.
-- Depends on: 20260702010000_discovery_shortlists_v2.sql (adds shortlist_assignment_status).
-- =============================================================================

-- 1. Dedupe any pre-existing shortlist-sourced duplicate rows before indexing.
--    Keeps the most advanced assignment (latest lifecycle), else the oldest row.
DO $$
DECLARE
  has_status_col boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'campaign_influencers'
      AND column_name = 'shortlist_assignment_status'
  ) INTO has_status_col;

  IF NOT has_status_col THEN
    RAISE EXCEPTION
      'campaign_influencers.shortlist_assignment_status missing — apply 20260702010000_discovery_shortlists_v2.sql first';
  END IF;

  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY campaign_header_id, influencer_id
        ORDER BY
          array_position(
            ARRAY['suggested','invited','approved','contracted','published','rejected','removed']::text[],
            shortlist_assignment_status::text
          ) DESC NULLS LAST,
          created_at ASC,
          id ASC
      ) AS rn
    FROM public.campaign_influencers
    WHERE shortlist_assignment_status IS NOT NULL
      AND campaign_header_id IS NOT NULL
  )
  -- Demote the losing duplicates so they fall outside the partial unique predicate,
  -- preserving the row (and its audit) instead of deleting vendor/assignment data.
  UPDATE public.campaign_influencers ci
  SET shortlist_assignment_status = NULL
  FROM ranked
  WHERE ci.id = ranked.id
    AND ranked.rn > 1;
END $$;

-- 2. Partial unique: one shortlist-sourced assignment per (campaign, creator).
CREATE UNIQUE INDEX IF NOT EXISTS campaign_influencers_shortlist_unique
  ON public.campaign_influencers (campaign_header_id, influencer_id)
  WHERE shortlist_assignment_status IS NOT NULL;

COMMENT ON INDEX public.campaign_influencers_shortlist_unique IS
  'Prevents duplicate shortlist-sourced creator assignments per campaign. Scoped to shortlist rows so multi-line vendor assignments remain valid.';
