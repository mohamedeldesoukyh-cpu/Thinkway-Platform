-- Creator Workspace Phase 2: scoped documentation-unit access + Client release backfill.
-- Development only. Does not grant campaigns.read / campaigns.write to creators.
-- Does not change Internal documentation SSOT.

-- Existing Internal-uploaded versions stay Client-visible after the release boundary lands.
UPDATE public.deliverable_asset_versions
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'released_to_client_at',
  to_char(uploaded_at AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
)
WHERE COALESCE(metadata->>'released_to_client_at', '') = '';

CREATE OR REPLACE FUNCTION public.current_creator_influencer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id
  FROM public.influencers i
  WHERE i.profile_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.creator_line_belongs_to_current_influencer(p_line_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_creator_influencer_id() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.campaign_influencers ci
        WHERE ci.campaign_line_id = p_line_id
          AND ci.influencer_id = public.current_creator_influencer_id()
      )
      OR EXISTS (
        SELECT 1
        FROM public.campaign_lines cl
        WHERE cl.id = p_line_id
          AND cl.metadata #>> '{influencer_assignment,influencer_id}'
            = public.current_creator_influencer_id()::text
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.creator_owns_documentation_unit(
  p_assignment_deliverable_id uuid,
  p_assignment_post_schedule_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line_id uuid;
  v_qty integer;
BEGIN
  IF NOT (
    public.has_permission('creator_portal.read')
    OR public.has_permission('creator_portal.write')
    OR public.is_admin()
  ) THEN
    RETURN false;
  END IF;

  IF public.current_creator_influencer_id() IS NULL THEN
    RETURN false;
  END IF;

  SELECT ad.campaign_line_id, ad.quantity
  INTO v_line_id, v_qty
  FROM public.assignment_deliverables ad
  WHERE ad.id = p_assignment_deliverable_id;

  IF v_line_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.creator_line_belongs_to_current_influencer(v_line_id) THEN
    RETURN false;
  END IF;

  IF p_assignment_post_schedule_id IS NULL THEN
    RETURN COALESCE(v_qty, 1) <= 1;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.assignment_post_schedule ps
    WHERE ps.id = p_assignment_post_schedule_id
      AND ps.assignment_deliverable_id = p_assignment_deliverable_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.creator_list_documentation_slots()
RETURNS TABLE (
  campaign_header_id uuid,
  campaign_name text,
  campaign_document_number text,
  campaign_line_id uuid,
  assignment_deliverable_id uuid,
  assignment_post_schedule_id uuid,
  sequence_number integer,
  quantity integer,
  deliverable_type text,
  platform text,
  due_date date,
  post_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_permission('creator_portal.read')
    OR public.has_permission('creator_portal.write')
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF public.current_creator_influencer_id() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ad.campaign_header_id,
    ch.name,
    ch.document_number,
    ad.campaign_line_id,
    ad.id,
    CASE WHEN ad.quantity <= 1 THEN NULL ELSE ps.id END,
    CASE WHEN ad.quantity <= 1 THEN NULL ELSE ps.sequence_number END,
    ad.quantity,
    ad.deliverable_type,
    ad.platform,
    COALESCE(ps.live_date, ad.live_date),
    CASE WHEN ad.quantity <= 1 THEN NULL ELSE ps.status::text END
  FROM public.assignment_deliverables ad
  JOIN public.campaign_headers ch ON ch.id = ad.campaign_header_id
  LEFT JOIN public.assignment_post_schedule ps
    ON ps.assignment_deliverable_id = ad.id
   AND ad.quantity > 1
  WHERE public.creator_line_belongs_to_current_influencer(ad.campaign_line_id)
    AND (ad.quantity <= 1 OR ps.id IS NOT NULL)
  ORDER BY ch.name, ad.sort_order, ps.sequence_number NULLS FIRST;
END;
$$;

REVOKE ALL ON FUNCTION public.current_creator_influencer_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.creator_line_belongs_to_current_influencer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.creator_owns_documentation_unit(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.creator_list_documentation_slots() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_creator_influencer_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.creator_line_belongs_to_current_influencer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.creator_owns_documentation_unit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.creator_list_documentation_slots() TO authenticated;

COMMENT ON FUNCTION public.creator_owns_documentation_unit(uuid, uuid) IS
  'Creator Workspace isolation: true only for the signed-in influencer''s own documentation unit. Never grants campaigns.write.';
COMMENT ON FUNCTION public.creator_list_documentation_slots() IS
  'Lists documentation-unit slots for the signed-in creator only. Omits commercial columns.';
