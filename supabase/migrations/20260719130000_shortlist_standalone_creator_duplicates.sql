-- Allow the same creator on a shortlist once as an individual row and again inside
-- a collapse bundle (Collap). Standalone rows remain unique per shortlist.

DROP INDEX IF EXISTS public.discovery_shortlist_items_profile_unique;
DROP INDEX IF EXISTS public.discovery_shortlist_items_influencer_unique;

CREATE UNIQUE INDEX IF NOT EXISTS discovery_shortlist_items_profile_standalone_unique
  ON public.discovery_shortlist_items (shortlist_id, profile_id)
  WHERE profile_id IS NOT NULL AND collapse_group_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS discovery_shortlist_items_influencer_standalone_unique
  ON public.discovery_shortlist_items (shortlist_id, influencer_id)
  WHERE influencer_id IS NOT NULL AND collapse_group_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS discovery_shortlist_items_profile_collapse_unique
  ON public.discovery_shortlist_items (shortlist_id, profile_id, collapse_group_id)
  WHERE profile_id IS NOT NULL AND collapse_group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS discovery_shortlist_items_influencer_collapse_unique
  ON public.discovery_shortlist_items (shortlist_id, influencer_id, collapse_group_id)
  WHERE influencer_id IS NOT NULL AND collapse_group_id IS NOT NULL;
