-- Discovery creator-centric identity: stable avatar + default metrics platform + shortlist account selection

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS primary_avatar_url text,
  ADD COLUMN IF NOT EXISTS primary_avatar_source text,
  ADD COLUMN IF NOT EXISTS default_metrics_platform_account_id uuid
    REFERENCES public.influencer_platform_accounts (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.influencers.primary_avatar_url IS
  'Stable creator-level avatar URL (Discovery identity). Priority: manual > uploaded > imported > IG > TikTok > YT > OpenGraph > placeholder.';
COMMENT ON COLUMN public.influencers.primary_avatar_source IS
  'Origin label for primary_avatar_url (manual, uploaded, imported, instagram, tiktok, youtube, opengraph, placeholder).';
COMMENT ON COLUMN public.influencers.default_metrics_platform_account_id IS
  'Platform account whose metrics are shown in Discovery list rows until user switches in detail sheet.';

ALTER TABLE public.discovery_shortlist_items
  ADD COLUMN IF NOT EXISTS platform_account_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

COMMENT ON COLUMN public.discovery_shortlist_items.platform_account_ids IS
  'Selected influencer_platform_accounts included when this creator was added to the shortlist.';

CREATE INDEX IF NOT EXISTS influencers_default_metrics_platform_account_idx
  ON public.influencers (default_metrics_platform_account_id)
  WHERE default_metrics_platform_account_id IS NOT NULL;
