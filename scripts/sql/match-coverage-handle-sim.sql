-- Exact normalized handle match simulation (path a)
WITH wh AS (
  SELECT id,
    LOWER(TRIM(REGEXP_REPLACE(COALESCE(username, ''), '^@+', ''))) AS norm_username,
    CASE WHEN display_name_raw LIKE '@%' THEN LOWER(TRIM(REGEXP_REPLACE(display_name_raw, '^@+', ''))) ELSE NULL END AS norm_display_as_handle
  FROM intelligence.int_influencers
),
ops_handles AS (
  SELECT DISTINCT LOWER(TRIM(REGEXP_REPLACE(handle, '^@+', ''))) AS norm_handle, influencer_id
  FROM public.influencer_platform_accounts
  WHERE handle IS NOT NULL AND TRIM(handle) <> ''
),
handle_matches AS (
  SELECT DISTINCT wh.id
  FROM wh
  WHERE (
    (norm_username <> '' AND EXISTS (SELECT 1 FROM ops_handles oh WHERE oh.norm_handle = wh.norm_username))
    OR (norm_display_as_handle IS NOT NULL AND EXISTS (SELECT 1 FROM ops_handles oh WHERE oh.norm_handle = wh.norm_display_as_handle))
  )
)
SELECT
  (SELECT COUNT(*) FROM intelligence.int_influencers) AS warehouse_total,
  (SELECT COUNT(*) FROM handle_matches) AS handle_path_matches,
  (SELECT COUNT(*) FROM intelligence.int_influencers WHERE match_confidence > 0) AS current_matched;
