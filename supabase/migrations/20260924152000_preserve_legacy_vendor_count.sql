-- Preserve the deployed app's existing name-only count until its search client is released.
-- New search uses vendor_identity_search_total_count and shares its matcher with the list.
CREATE OR REPLACE FUNCTION public.vendor_list_total_count(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_platform text DEFAULT NULL,
  p_crm_only boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := NULLIF(trim(p_search), '');
  v_status text := NULLIF(trim(p_status), '');
  v_platform text := NULLIF(trim(p_platform), '');
  v_pattern text;
  v_total bigint;
BEGIN
  IF NOT public.has_permission('influencers.read') THEN
    RETURN 0;
  END IF;

  v_pattern := CASE
    WHEN v_search IS NULL THEN NULL
    ELSE '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    END;

  IF public.is_internal_user() THEN
    SELECT COUNT(*)::bigint
    INTO v_total
    FROM public.influencers i
    WHERE (NOT p_crm_only OR i.has_commercial_profile = true)
      AND (v_status IS NULL OR i.status::text = v_status)
      AND (
        v_pattern IS NULL
        OR i.display_name ILIKE v_pattern ESCAPE '\'
        OR i.legal_name ILIKE v_pattern ESCAPE '\'
        OR i.document_number ILIKE v_pattern ESCAPE '\'
        OR i.email ILIKE v_pattern ESCAPE '\'
      )
      AND (
        v_platform IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.influencer_platform_accounts a
          WHERE a.influencer_id = i.id
            AND a.platform = v_platform
        )
      );
    RETURN COALESCE(v_total, 0);
  END IF;

  SELECT COUNT(*)::bigint
  INTO v_total
  FROM public.influencers i
  WHERE public.can_access_influencer(i.id)
    AND (NOT p_crm_only OR i.has_commercial_profile = true)
    AND (v_status IS NULL OR i.status::text = v_status)
    AND (
      v_pattern IS NULL
      OR i.display_name ILIKE v_pattern ESCAPE '\'
      OR i.legal_name ILIKE v_pattern ESCAPE '\'
      OR i.document_number ILIKE v_pattern ESCAPE '\'
      OR i.email ILIKE v_pattern ESCAPE '\'
    )
    AND (
      v_platform IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.influencer_platform_accounts a
        WHERE a.influencer_id = i.id
          AND a.platform = v_platform
      )
    );

  RETURN COALESCE(v_total, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_list_total_count(text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_list_total_count(text, text, text, boolean) TO authenticated;
