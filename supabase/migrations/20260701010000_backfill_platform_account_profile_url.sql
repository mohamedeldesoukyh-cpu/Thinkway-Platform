-- Backfill profile_url for influencer_platform_accounts that were imported
-- before profile URLs were derived (e.g. early Discovery Import runs).
--
-- This is a non-destructive fill: it only touches rows where profile_url is
-- NULL/blank and a usable handle/username exists. Canonical URLs are derived
-- from platform + normalized handle, mirroring lib/social/platforms.ts
-- (buildCanonicalProfileUrl). Safe to run; review before pushing.

with derived as (
  select
    id,
    lower(regexp_replace(coalesce(nullif(trim(username), ''), nullif(trim(handle), ''), normalized_username), '^@+', '')) as h,
    lower(trim(platform)) as p
  from public.influencer_platform_accounts
  where (profile_url is null or trim(profile_url) = '')
    and coalesce(nullif(trim(username), ''), nullif(trim(handle), ''), normalized_username) is not null
)
update public.influencer_platform_accounts a
set
  profile_url = case d.p
    when 'instagram' then 'https://www.instagram.com/' || d.h || '/'
    when 'tiktok'    then 'https://www.tiktok.com/@' || d.h
    when 'youtube'   then 'https://www.youtube.com/@' || d.h
    when 'snapchat'  then 'https://www.snapchat.com/add/' || d.h
    when 'twitter'   then 'https://x.com/' || d.h
    when 'linkedin'  then 'https://www.linkedin.com/in/' || d.h
    when 'facebook'  then 'https://www.facebook.com/' || d.h
    else 'https://' || d.p || '.com/' || d.h
  end,
  updated_at = now()
from derived d
where a.id = d.id
  and d.h is not null
  and d.h <> '';

-- Keep normalized_profile_url consistent (lowercased, no trailing slash).
update public.influencer_platform_accounts
set normalized_profile_url = regexp_replace(lower(trim(profile_url)), '/+$', '')
where profile_url is not null
  and trim(profile_url) <> ''
  and (normalized_profile_url is null or trim(normalized_profile_url) = '');
