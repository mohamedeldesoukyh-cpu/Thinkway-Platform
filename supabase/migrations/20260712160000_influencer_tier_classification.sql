-- Platform-wide influencer tier classification (follower-based SSOT for SQL consumers).

CREATE OR REPLACE FUNCTION public.get_influencer_tier(follower_count bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN follower_count < 10000 THEN 'Nano'
    WHEN follower_count < 100000 THEN 'Micro'
    WHEN follower_count < 500000 THEN 'Mid'
    WHEN follower_count < 1000000 THEN 'Macro'
    WHEN follower_count < 5000000 THEN 'Mega'
    ELSE 'Celebrity'
  END;
$$;

COMMENT ON FUNCTION public.get_influencer_tier(bigint) IS
  'Follower-based tier: Nano (<10K), Micro (<100K), Mid (<500K), Macro (<1M), Mega (<5M), Celebrity (5M+).';

-- Optional: normalize legacy imported tier labels in intelligence warehouse.
UPDATE intelligence.int_influencers
SET tier = CASE lower(trim(tier))
  WHEN 'mid-tier' THEN 'Mid'
  WHEN 'midtier' THEN 'Mid'
  WHEN 'mega' THEN 'Mega'
  WHEN 'macro' THEN 'Macro'
  WHEN 'micro' THEN 'Micro'
  WHEN 'nano' THEN 'Nano'
  WHEN 'celebrity' THEN 'Celebrity'
  WHEN 'celeb' THEN 'Celebrity'
  ELSE initcap(trim(tier))
END
WHERE tier IS NOT NULL
  AND trim(tier) <> ''
  AND lower(trim(tier)) IN (
    'mid-tier', 'midtier', 'mega', 'macro', 'micro', 'nano', 'celebrity', 'celeb'
  );
