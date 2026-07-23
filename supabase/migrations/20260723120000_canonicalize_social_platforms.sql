-- Canonicalize social platform identity to lowercase SocialPlatform keys.
-- Mixed-case values (e.g. "Snapchat") broke enrichment gates that used exact
-- isSocialPlatform() checks and silently dropped Snapchat from Apify batch runs.

UPDATE public.influencer_platform_accounts
SET platform = lower(trim(platform))
WHERE platform IS NOT NULL
  AND platform <> lower(trim(platform));

UPDATE public.discovered_profiles
SET platform = lower(trim(platform))
WHERE platform IS NOT NULL
  AND platform <> lower(trim(platform));

-- Alias cleanup for common short codes stored as platform.
UPDATE public.influencer_platform_accounts
SET platform = CASE lower(trim(platform))
  WHEN 'ig' THEN 'instagram'
  WHEN 'insta' THEN 'instagram'
  WHEN 'tt' THEN 'tiktok'
  WHEN 'yt' THEN 'youtube'
  WHEN 'sc' THEN 'snapchat'
  WHEN 'snap' THEN 'snapchat'
  WHEN 'fb' THEN 'facebook'
  WHEN 'x' THEN 'twitter'
  ELSE lower(trim(platform))
END
WHERE lower(trim(platform)) IN ('ig', 'insta', 'tt', 'yt', 'sc', 'snap', 'fb', 'x');

UPDATE public.discovered_profiles
SET platform = CASE lower(trim(platform))
  WHEN 'ig' THEN 'instagram'
  WHEN 'insta' THEN 'instagram'
  WHEN 'tt' THEN 'tiktok'
  WHEN 'yt' THEN 'youtube'
  WHEN 'sc' THEN 'snapchat'
  WHEN 'snap' THEN 'snapchat'
  WHEN 'fb' THEN 'facebook'
  WHEN 'x' THEN 'twitter'
  ELSE lower(trim(platform))
END
WHERE lower(trim(platform)) IN ('ig', 'insta', 'tt', 'yt', 'sc', 'snap', 'fb', 'x');

COMMENT ON COLUMN public.influencer_platform_accounts.platform IS
  'Canonical SocialPlatform key (lowercase): instagram|tiktok|youtube|snapchat|twitter|linkedin|facebook.';

COMMENT ON COLUMN public.discovered_profiles.platform IS
  'Canonical SocialPlatform key (lowercase): instagram|tiktok|youtube|snapchat|twitter|linkedin|facebook.';
