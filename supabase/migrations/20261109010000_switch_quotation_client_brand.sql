-- Explicit ownership change: keep commercial lines, detach source identity and
-- invalidate old public links in the same transaction as the client/brand update.
CREATE OR REPLACE FUNCTION public.switch_quotation_client_brand(
  p_quotation_id uuid, p_client_id uuid, p_brand_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  q public.quotations%ROWTYPE;
  journey_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_permission('discovery.write') OR public.has_permission('discovery.admin')) THEN
    RAISE EXCEPTION 'You do not have permission to change quotation clients.';
  END IF;
  SELECT * INTO q FROM public.quotations WHERE id = p_quotation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quotation not found.'; END IF;
  IF q.status IN ('approved', 'archived', 'cancelled') OR q.is_archived THEN
    RAISE EXCEPTION 'Create a new draft quotation before changing the client of a locked quotation.';
  END IF;
  IF p_client_id IS NULL OR p_brand_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.brands WHERE id = p_brand_id AND client_id = p_client_id
  ) THEN RAISE EXCEPTION 'Select a brand belonging to the selected client.'; END IF;
  IF q.client_id = p_client_id AND q.brand_id = p_brand_id AND NOT q.is_temporary_client AND NOT q.is_temporary_brand THEN RETURN; END IF;
  IF q.campaign_header_id IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.campaign_headers WHERE quotation_id = q.id OR accepted_quotation_id = q.id
  ) OR EXISTS (SELECT 1 FROM public.campaign_lines WHERE source_quotation_id = q.id) THEN
    RAISE EXCEPTION 'This quotation is already linked to a campaign. Duplicate it before choosing a different client.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.quotations WHERE parent_quotation_id = q.id) THEN
    RAISE EXCEPTION 'This quotation has later versions. Change the client on the latest draft version or duplicate it.';
  END IF;
  SELECT array_agg(DISTINCT id) INTO journey_ids FROM public.campaign_client_journeys
  WHERE quotation_id = q.id OR id IN (SELECT journey_id FROM public.campaign_client_reviews WHERE quotation_id = q.id);
  -- Rotate journey tokens as a former client may still have the shared shortlist link.
  UPDATE public.campaign_client_journeys SET token_hash = encode(extensions.gen_random_bytes(32), 'hex'),
    share_token = NULL, quotation_id = CASE WHEN quotation_id = q.id THEN NULL ELSE quotation_id END,
    landing_review_id = NULL, updated_at = now()
  WHERE id = ANY(COALESCE(journey_ids, ARRAY[]::uuid[]));
  UPDATE public.campaign_client_reviews SET status = 'revoked', share_token = NULL,
    token_hash = encode(extensions.gen_random_bytes(32), 'hex'), updated_at = now()
  WHERE quotation_id = q.id OR journey_id = ANY(COALESCE(journey_ids, ARRAY[]::uuid[]));
  -- Historical snapshots remain, but cannot be refreshed or reactivated for the new client.
  UPDATE public.campaign_client_reviews SET quotation_id = NULL WHERE quotation_id = q.id;
  UPDATE public.quotations SET client_id = p_client_id, brand_id = p_brand_id,
    is_temporary_client = false, is_temporary_brand = false,
    temporary_client_name = NULL, temporary_brand_name = NULL,
    shortlist_id = NULL, campaign_object_id = NULL, source_campaign_object_version = NULL,
    parent_quotation_id = NULL, shared_with_client = false, client_visible = false,
    client_approval_status = NULL, client_signed_at = NULL, client_signature_name = NULL,
    client_shared_at = NULL, client_shared_by = NULL, client_comment = NULL,
    approved_at = NULL, approved_by = NULL, status = 'draft', updated_at = now()
  WHERE id = q.id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (auth.uid(), 'update', 'quotation', q.id,
    jsonb_build_object('client_id', q.client_id, 'brand_id', q.brand_id, 'shortlist_id', q.shortlist_id),
    jsonb_build_object('client_id', p_client_id, 'brand_id', p_brand_id, 'event', 'quotation.client_changed'));
END;
$$;
REVOKE ALL ON FUNCTION public.switch_quotation_client_brand(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.switch_quotation_client_brand(uuid, uuid, uuid) TO authenticated;
