-- Top 10 high-volume campaign-linked influencers with match_confidence = 0
WITH line_counts AS (
  SELECT int_influencer_id, COUNT(*) AS line_count
  FROM intelligence.int_campaigns
  WHERE int_influencer_id IS NOT NULL
  GROUP BY int_influencer_id
)
SELECT i.display_name_raw, i.username, i.country, i.tier, lc.line_count
FROM line_counts lc
JOIN intelligence.int_influencers i ON i.id = lc.int_influencer_id
WHERE COALESCE(i.match_confidence, 0) = 0
ORDER BY lc.line_count DESC
LIMIT 10;
