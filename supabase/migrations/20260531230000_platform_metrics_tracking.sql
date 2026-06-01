-- Platform metrics tracking — distinguish synced vs manual vs unavailable metrics.

DO $$ BEGIN
  ALTER TYPE public.platform_sync_status ADD VALUE IF NOT EXISTS 'pending_api';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'platform_metrics_source'
  ) THEN
    CREATE TYPE public.platform_metrics_source AS ENUM (
      'synced',
      'manual',
      'unavailable',
      'pending_api'
    );
  END IF;
END $$;

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS metrics_source public.platform_metrics_source NOT NULL DEFAULT 'unavailable';

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS metrics_last_synced_at timestamptz;

ALTER TABLE public.influencer_platform_accounts
  ADD COLUMN IF NOT EXISTS metrics_is_manual_override boolean NOT NULL DEFAULT false;

-- Allow NULL when metrics are unknown (avoid storing misleading zeros).
ALTER TABLE public.influencer_platform_accounts
  ALTER COLUMN follower_count DROP NOT NULL;

ALTER TABLE public.influencer_platform_accounts
  ALTER COLUMN follower_count DROP DEFAULT;

ALTER TABLE public.influencer_platform_accounts
  ALTER COLUMN following_count DROP NOT NULL;

ALTER TABLE public.influencer_platform_accounts
  ALTER COLUMN following_count DROP DEFAULT;

ALTER TABLE public.influencer_platform_accounts
  ALTER COLUMN avg_views DROP NOT NULL;

ALTER TABLE public.influencer_platform_accounts
  ALTER COLUMN avg_views DROP DEFAULT;

-- Rows with zero followers and no manual override likely predate nullable metrics.
UPDATE public.influencer_platform_accounts
SET
  metrics_source = CASE
    WHEN metrics_is_manual_override THEN 'manual'::public.platform_metrics_source
    WHEN sync_status = 'synced'::public.platform_sync_status THEN 'synced'::public.platform_metrics_source
    WHEN platform IN ('instagram', 'snapchat') THEN 'pending_api'::public.platform_metrics_source
    ELSE 'unavailable'::public.platform_metrics_source
  END,
  metrics_last_synced_at = COALESCE(metrics_last_synced_at, last_synced_at)
WHERE metrics_source = 'unavailable'::public.platform_metrics_source
  AND follower_count = 0
  AND NOT metrics_is_manual_override;
