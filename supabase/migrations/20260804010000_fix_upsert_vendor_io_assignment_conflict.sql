-- STAB: upsert_vendor_io_from_assignment used ON CONFLICT (assignment_id) after
-- vendor_ios_assignment_id_key was dropped (20260605010000) to allow revisions.
-- Rebuild as select-then-update/insert against the active (non-superseded) tip,
-- and link the assignment line when present.

CREATE OR REPLACE FUNCTION public.upsert_vendor_io_from_assignment(
  p_assignment_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_row record;
  v_vendor_terms text;
  v_line_id uuid;
BEGIN
  SELECT
    ci.id,
    ci.campaign_header_id,
    ci.campaign_line_id,
    ci.influencer_id,
    ci.agreed_fee,
    ci.currency,
    ci.deliverable_count,
    ci.status AS assignment_status
  INTO v_row
  FROM public.campaign_influencers ci
  WHERE ci.id = p_assignment_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Assignment not found.';
  END IF;

  SELECT NULLIF(trim(i.vendor_io_terms_text), '')
  INTO v_vendor_terms
  FROM public.influencers i
  WHERE i.id = v_row.influencer_id;

  -- Active tip already keyed to this assignment
  SELECT v.id
  INTO v_id
  FROM public.vendor_ios v
  WHERE v.assignment_id = p_assignment_id
    AND v.is_superseded = false
  ORDER BY v.revision_number DESC NULLS LAST, v.created_at DESC NULLS LAST, v.id DESC
  LIMIT 1;

  -- Fallback: unique active VIO per campaign + influencer
  IF v_id IS NULL THEN
    SELECT v.id
    INTO v_id
    FROM public.vendor_ios v
    WHERE v.campaign_header_id = v_row.campaign_header_id
      AND v.influencer_id = v_row.influencer_id
      AND v.is_superseded = false
    ORDER BY v.created_at DESC NULLS LAST, v.id DESC
    LIMIT 1;
  END IF;

  IF v_id IS NOT NULL THEN
    UPDATE public.vendor_ios
    SET
      assignment_id = v_row.id,
      campaign_header_id = v_row.campaign_header_id,
      influencer_id = v_row.influencer_id,
      amount = COALESCE(v_row.agreed_fee, amount),
      currency_code = COALESCE(v_row.currency, currency_code),
      updated_by = COALESCE(p_actor_id, updated_by),
      updated_at = timezone('utc', now())
    WHERE id = v_id
      AND status = 'draft'::public.vendor_io_status
      AND is_superseded = false;
  ELSE
    INSERT INTO public.vendor_ios (
      assignment_id,
      campaign_header_id,
      influencer_id,
      amount,
      currency_code,
      status,
      terms_text,
      created_by,
      updated_by
    )
    VALUES (
      v_row.id,
      v_row.campaign_header_id,
      v_row.influencer_id,
      COALESCE(v_row.agreed_fee, 0),
      COALESCE(v_row.currency, 'USD'),
      'draft'::public.vendor_io_status,
      v_vendor_terms,
      p_actor_id,
      p_actor_id
    )
    RETURNING id INTO v_id;
  END IF;

  v_line_id := v_row.campaign_line_id;
  IF v_line_id IS NOT NULL AND v_id IS NOT NULL THEN
    INSERT INTO public.vendor_io_lines (vendor_io_id, campaign_line_id)
    VALUES (v_id, v_line_id)
    ON CONFLICT (campaign_line_id) DO UPDATE
      SET vendor_io_id = EXCLUDED.vendor_io_id;

    UPDATE public.campaign_lines
    SET
      vendor_io_id = v_id,
      operational_status = CASE
        WHEN operational_status = 'draft'::public.campaign_line_operational_status
          THEN 'io_generated'::public.campaign_line_operational_status
        ELSE operational_status
      END,
      billing_status = CASE
        WHEN billing_status = 'draft'::public.campaign_line_billing_status
          THEN 'moved_to_billing'::public.campaign_line_billing_status
        ELSE billing_status
      END
    WHERE id = v_line_id
      AND (vendor_io_id IS NULL OR vendor_io_id = v_id);
  END IF;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.upsert_vendor_io_from_assignment(uuid, uuid) IS
  'Idempotent Vendor IO tip for an assignment. Does not use ON CONFLICT(assignment_id); unique tip is (campaign, influencer) where not superseded.';
