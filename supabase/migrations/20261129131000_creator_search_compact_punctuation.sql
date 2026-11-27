-- Keep compact name matching consistent with the browser for apostrophes,
-- separators and all whitespace (e.g. Omar's Cooking -> omarscooking).
BEGIN;
CREATE OR REPLACE FUNCTION public.creator_search_compact_name(value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$ SELECT regexp_replace(public.creator_search_normalize(coalesce(value, '')), '[[:space:][:punct:]]', '', 'g'); $$;

-- Expression indexes must be rebuilt when their immutable normalizer changes.
REINDEX INDEX public.influencers_display_name_compact_idx;
REINDEX INDEX public.influencers_legal_name_compact_idx;
REINDEX INDEX public.influencer_platform_accounts_profile_display_name_compact_idx;
REINDEX INDEX public.discovered_profiles_display_name_compact_idx;
COMMIT;
