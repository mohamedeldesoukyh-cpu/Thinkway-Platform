-- Line-scoped campaign_influencers uniqueness (one vendor row per assignment line).
-- Replaces legacy UNIQUE (campaign_id, influencer_id) which blocked multiple lines
-- for the same creator and caused duplicate-key errors on assignment save.

-- Backfill line links from assignment metadata where missing
UPDATE public.campaign_influencers ci
SET campaign_line_id = cl.id
FROM public.campaign_lines cl
WHERE ci.campaign_line_id IS NULL
  AND COALESCE(ci.campaign_header_id, ci.campaign_id) = cl.campaign_header_id
  AND (cl.metadata -> 'influencer_assignment' ->> 'influencer_id')::uuid = ci.influencer_id;

-- Ensure header id is populated
UPDATE public.campaign_influencers
SET campaign_header_id = campaign_id
WHERE campaign_header_id IS NULL;

-- Deduplicate before adding line-scoped unique constraint
DELETE FROM public.campaign_influencers a
USING public.campaign_influencers b
WHERE a.id > b.id
  AND COALESCE(a.campaign_header_id, a.campaign_id) = COALESCE(b.campaign_header_id, b.campaign_id)
  AND a.campaign_line_id IS NOT DISTINCT FROM b.campaign_line_id
  AND a.influencer_id = b.influencer_id
  AND a.campaign_line_id IS NOT NULL;

ALTER TABLE public.campaign_influencers
  DROP CONSTRAINT IF EXISTS campaign_influencers_unique;

ALTER TABLE public.campaign_influencers
  ADD CONSTRAINT campaign_influencers_unique
  UNIQUE (campaign_header_id, campaign_line_id, influencer_id);
