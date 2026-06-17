-- Sample rows: matched influencers
SELECT id, display_name_raw, username, platform, country, tier,
       match_confidence, resolved_influencer_id, source_keys
FROM intelligence.int_influencers
WHERE match_confidence > 0
ORDER BY match_confidence DESC
LIMIT 5;
