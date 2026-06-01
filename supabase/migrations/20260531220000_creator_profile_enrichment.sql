-- Creator profile enrichment — platform URL parsing, sync metadata, duplicate detection.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'platform_sync_status') THEN
    CREATE TYPE public.platform_sync_status AS ENUM (
      'pending',
      'synced',
      'partial',
      'failed',
      'manual'
    );
  END IF;
END $$;

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS normalized_username citext;

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS normalized_profile_url text;

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS profile_display_name text;

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS profile_bio text;

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS profile_picture_url text;

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS following_count bigint NOT NULL DEFAULT 0;

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS sync_status public.platform_sync_status NOT NULL DEFAULT 'manual';

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS sync_source text;

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS sync_error text;

-- Backfill normalized fields from existing data
UPDATE public.influencer_platform_accounts
SET
  normalized_username = lower(trim(both '@' from COALESCE(username, handle::text))),
  normalized_profile_url = lower(trim(trailing '/' from COALESCE(profile_url, ''))),
  sync_status = 'manual'
WHERE normalized_username IS NULL;

CREATE INDEX IF NOT EXISTS influencer_platform_accounts_platform_normalized_username_idx
  ON public.influencer_platform_accounts (platform, normalized_username)
  WHERE normalized_username IS NOT NULL AND btrim(normalized_username::text) <> '';
