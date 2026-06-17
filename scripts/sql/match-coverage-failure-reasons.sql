-- Failure reason quantification (warehouse vs operational handles)
WITH wh AS (
  SELECT id, display_name_raw, username, match_confidence,
    LOWER(TRIM(REGEXP_REPLACE(COALESCE(username, ''), '^@+', ''))) AS norm_username,
    LOWER(TRIM(REGEXP_REPLACE(COALESCE(display_name_raw, ''), '^@+', ''))) AS norm_display_handle
  FROM intelligence.int_influencers
),
ops_handles AS (
  SELECT DISTINCT LOWER(TRIM(REGEXP_REPLACE(handle, '^@+', ''))) AS norm_handle
  FROM public.influencer_platform_accounts
  WHERE handle IS NOT NULL AND TRIM(handle) <> ''
),
campaign_linked AS (
  SELECT DISTINCT int_influencer_id AS id FROM intelligence.int_campaigns WHERE int_influencer_id IS NOT NULL
)
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE match_confidence > 0) AS current_matched,
  COUNT(*) FILTER (WHERE username IS NULL OR TRIM(username) = '') AS no_username,
  COUNT(*) FILTER (
    WHERE username IS NOT NULL AND TRIM(username) <> ''
      AND NOT EXISTS (SELECT 1 FROM ops_handles oh WHERE oh.norm_handle = wh.norm_username)
  ) AS username_no_handle_match,
  COUNT(*) FILTER (
    WHERE username IS NOT NULL AND TRIM(username) <> ''
      AND EXISTS (SELECT 1 FROM ops_handles oh WHERE oh.norm_handle = wh.norm_username)
      AND match_confidence = 0
  ) AS handle_matchable_but_zero_conf,
  COUNT(*) FILTER (
    WHERE EXISTS (SELECT 1 FROM campaign_linked cl WHERE cl.id = wh.id)
      AND (username IS NULL OR TRIM(username) = '')
  ) AS campaign_linked_null_username,
  COUNT(*) FILTER (
    WHERE username IS NOT NULL AND TRIM(username) <> ''
      AND EXISTS (SELECT 1 FROM ops_handles oh WHERE oh.norm_handle = wh.norm_username)
  ) AS exact_handle_would_match
FROM wh;
