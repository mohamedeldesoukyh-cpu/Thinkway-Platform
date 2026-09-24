-- Shared literal substring search: names, partial/short names, handles, slugs,
-- and profile URLs. Normalize case, @, separators, and social URL decorations.
CREATE OR REPLACE FUNCTION public.vendor_identity_search_key(value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT regexp_replace(
    rtrim(regexp_replace(
      regexp_replace(
        regexp_replace(lower(trim(coalesce(value, ''))), '^https?://', ''),
        '^(www\.|m\.)?(instagram\.com|tiktok\.com|twitter\.com|x\.com|facebook\.com|youtube\.com|snapchat\.com|linkedin\.com)/', ''),
      '[?#].*$', ''), '/'),
    '[[:space:]@._-]+', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.search_vendor_identities(p_search text DEFAULT NULL)
RETURNS SETOF public.influencers
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_read boolean := public.has_permission('influencers.read');
  v_internal boolean := v_read AND public.is_internal_user();
  v_needle text := public.vendor_identity_search_key(p_search);
BEGIN
  -- Equivalent to influencers_select: internal readers, linked self, or scoped
  -- campaign access with read permission. Check role once, avoiding per-row RLS
  -- timeouts (same approach as the existing Discovery search RPC).
  IF v_user IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT i.* FROM public.influencers i
  WHERE (v_internal OR i.profile_id = v_user
    OR (v_read AND public.can_access_influencer(i.id)))
  AND (nullif(trim(p_search), '') IS NULL
    OR (v_needle <> '' AND (
      strpos(public.vendor_identity_search_key(i.display_name), v_needle) > 0
      OR strpos(public.vendor_identity_search_key(i.legal_name), v_needle) > 0
      OR strpos(public.vendor_identity_search_key(i.slug), v_needle) > 0
      OR strpos(public.vendor_identity_search_key(i.document_number), v_needle) > 0
      OR strpos(public.vendor_identity_search_key(i.email), v_needle) > 0
      OR strpos(public.vendor_identity_search_key(i.influencer_url), v_needle) > 0
      OR EXISTS (
        SELECT 1 FROM public.influencer_platform_accounts a
        WHERE a.influencer_id = i.id
          AND (strpos(public.vendor_identity_search_key(a.handle), v_needle) > 0
            OR strpos(public.vendor_identity_search_key(a.profile_display_name), v_needle) > 0
            OR strpos(public.vendor_identity_search_key(a.profile_url), v_needle) > 0)
      )
    )));
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_identity_search_total_count(
  p_search text DEFAULT NULL, p_status text DEFAULT NULL,
  p_platform text DEFAULT NULL, p_crm_only boolean DEFAULT false
)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT count(*) FROM public.search_vendor_identities(p_search) i
    WHERE (NOT p_crm_only OR i.has_commercial_profile)
      AND (nullif(trim(p_status), '') IS NULL OR i.status::text = trim(p_status))
      AND (nullif(trim(p_platform), '') IS NULL OR EXISTS (
        SELECT 1 FROM public.influencer_platform_accounts a
        WHERE a.influencer_id = i.id AND a.platform = trim(p_platform)
      ))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_identity_search_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_vendor_identities(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendor_identity_search_total_count(text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_identity_search_key(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_vendor_identities(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vendor_identity_search_total_count(text,text,text,boolean) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
