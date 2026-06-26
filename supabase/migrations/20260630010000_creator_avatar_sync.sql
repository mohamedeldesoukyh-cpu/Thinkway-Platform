-- Creator profile photo sync governance on platform accounts.
ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS avatar_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS avatar_last_synced_at timestamptz;

ALTER TABLE public.influencer_platform_accounts
  DROP CONSTRAINT IF EXISTS influencer_platform_accounts_avatar_source_check;

ALTER TABLE public.influencer_platform_accounts
  ADD CONSTRAINT influencer_platform_accounts_avatar_source_check
  CHECK (avatar_source IN ('manual', 'apify', 'discovery', 'uploaded'));

COMMENT ON COLUMN public.influencer_platform_accounts.avatar_source IS
  'Origin of profile_picture_url: manual (never auto-overwrite), apify, discovery, uploaded.';

COMMENT ON COLUMN public.influencer_platform_accounts.avatar_last_synced_at IS
  'When profile_picture_url was last refreshed from an automated source.';

CREATE INDEX IF NOT EXISTS influencer_platform_accounts_avatar_sync_idx
  ON public.influencer_platform_accounts (avatar_source, avatar_last_synced_at)
  WHERE profile_picture_url IS NULL OR profile_picture_url = '';
