CREATE OR REPLACE VIEW public.campaign_fx_po_totals WITH (security_invoker = true) AS
SELECT h.id AS campaign_header_id,
  CASE WHEN h.po_amount_original > 0 THEN
    round(h.po_amount_original * public.resolve_effective_exchange_rate(
      coalesce(h.po_currency,h.currency_code),h.currency_code),2)
    WHEN h.po_amount_campaign_currency > 0 THEN h.po_amount_campaign_currency
    ELSE coalesce(l.budget,0) END AS po_amount,
  coalesce(l.consumed,0) AS po_consumed,
  CASE WHEN h.po_amount_original > 0 THEN public.resolve_effective_exchange_rate(
    coalesce(h.po_currency,h.currency_code),h.currency_code) ELSE NULL END AS po_rate
FROM public.campaign_headers h
LEFT JOIN LATERAL (
  SELECT round(sum(round(coalesce(cl.po_amount,0) *
      public.resolve_effective_exchange_rate(coalesce(cl.currency_code,h.currency_code),'EGP'),2)) /
      public.resolve_effective_exchange_rate(h.currency_code,'EGP'),2) AS budget,
    round(sum(round(public.resolve_line_po_billable_base(cl.revenue_before_vat,cl.revenue,
      cl.usage_rights_amount,cl.agency_fee_amount,cl.agency_fee_percent) *
      public.resolve_effective_exchange_rate(coalesce(cl.currency_code,h.currency_code),'EGP'),2)) /
      public.resolve_effective_exchange_rate(h.currency_code,'EGP'),2) AS consumed
  FROM public.campaign_lines cl WHERE cl.campaign_header_id=h.id AND cl.status <> 'cancelled'
) l ON true;
GRANT SELECT ON public.campaign_fx_po_totals TO authenticated, service_role;


-- Soft removal: preserve assignment records, issued IO snapshots and approval history.
CREATE OR REPLACE FUNCTION public.remove_campaign_assignment(
  p_campaign_id uuid, p_line_id uuid, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_line public.campaign_lines%ROWTYPE;
  v_io record;
  v_event uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_permission('campaigns.write')
     OR NOT public.can_access_campaign_header(p_campaign_id) THEN
    RAISE EXCEPTION 'You do not have permission to remove assignments.';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Enter a reason for removing this assignment.';
  END IF;
  SELECT * INTO v_line FROM public.campaign_lines
    WHERE id = p_line_id AND campaign_header_id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found.'; END IF;
  IF v_line.status = 'cancelled' THEN RETURN; END IF;

  IF v_line.invoice_id IS NOT NULL OR v_line.billing_status NOT IN ('draft', 'approved')
     OR EXISTS (SELECT 1 FROM public.invoice_line_items WHERE campaign_line_id = p_line_id) THEN
    RAISE EXCEPTION 'This assignment has billing records. Resolve the invoice/billing allocation before removing it.';
  END IF;
  IF v_line.vendor_io_id IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.vendor_io_lines WHERE campaign_line_id = p_line_id
  ) OR EXISTS (SELECT 1 FROM public.vendor_ios v JOIN public.campaign_influencers a ON a.id = v.assignment_id
    WHERE a.campaign_line_id = p_line_id AND v.status <> 'cancelled' AND NOT v.is_superseded) THEN
    RAISE EXCEPTION 'This assignment has a Vendor IO. Resolve or un-generate the Vendor IO before removing it; accepted vendor obligations cannot be deleted.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.assignment_post_schedule
             WHERE campaign_line_id = p_line_id AND status IN ('posted', 'verified')) THEN
    RAISE EXCEPTION 'Published work cannot be removed. Resolve the delivered work before changing this assignment.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.campaign_publications WHERE campaign_line_id = p_line_id)
     OR EXISTS (SELECT 1 FROM public.creator_payment_entries e JOIN public.campaign_influencers a
                ON a.id = e.assignment_id WHERE a.campaign_line_id = p_line_id) THEN
    RAISE EXCEPTION 'This assignment has publications or payment history and cannot be removed.';
  END IF;
  INSERT INTO public.business_change_events
    (event_type, reason_code, reason_detail, campaign_header_id, entity_type, entity_id, payload, actor_id)
    VALUES ('creator_removed', 'creator_removed', trim(p_reason), p_campaign_id,
      'campaign_line', p_line_id, jsonb_build_object('retained_for_history', true), auth.uid()) RETURNING id INTO v_event;
  -- Never edit the old document payload, assignment junction or approval records.
  FOR v_io IN SELECT * FROM public.client_ios
    WHERE campaign_header_id = p_campaign_id AND NOT is_superseded
      AND status IN ('generated', 'sent', 'under_client_review', 'approved', 'rejected', 'revision_required') FOR UPDATE
  LOOP
    IF v_io.assignment_snapshot IS NULL THEN
      RAISE EXCEPTION 'The existing Client IO has no frozen assignment snapshot. Preserve its historical document before removing an assignment.';
    END IF;
    UPDATE public.client_ios SET status = 'revision_required', updated_by = auth.uid(),
      lifecycle_reason_code = 'creator_removed', lifecycle_reason_detail = trim(p_reason),
      lifecycle_changed_at = now(), lifecycle_changed_by = auth.uid()
      WHERE id = v_io.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'You do not have permission to revise the Client IO.'; END IF;
    INSERT INTO public.document_lifecycle_reactions
      (business_change_event_id, document_type, document_id, from_status, to_status, reason_code, reason_detail, recommended_actions)
      VALUES (v_event, 'client_io', v_io.id, v_io.status, 'revision_required', 'creator_removed', trim(p_reason),
        ARRAY['preview_changes', 'regenerate', 'send_updated_version']);
  END LOOP;
  UPDATE public.campaign_lines
    SET status = 'cancelled', metadata = coalesce(metadata, '{}'::jsonb) ||
      jsonb_build_object('assignment_removal', jsonb_build_object(
        'reason', trim(p_reason), 'removed_by', auth.uid(), 'removed_at', now(),
        'previous_status', v_line.status))
    WHERE id = p_line_id;
  UPDATE public.campaign_influencers SET status = 'cancelled', shortlist_assignment_status = 'removed'
    WHERE campaign_line_id = p_line_id;
  PERFORM public.sync_campaign_header_po_consumption(p_campaign_id);
END;
$$;
REVOKE ALL ON FUNCTION public.remove_campaign_assignment(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_campaign_assignment(uuid, uuid, text) TO authenticated;

-- A stale editor must not reactivate or change an assignment retained for history.
CREATE OR REPLACE FUNCTION public.guard_removed_campaign_assignment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.metadata ? 'assignment_removal' AND (
    NEW.status IS DISTINCT FROM OLD.status OR NEW.metadata IS DISTINCT FROM OLD.metadata OR
    NEW.revenue IS DISTINCT FROM OLD.revenue OR NEW.cost IS DISTINCT FROM OLD.cost OR
    NEW.billing_status IS DISTINCT FROM OLD.billing_status OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR
    NEW.vendor_io_id IS DISTINCT FROM OLD.vendor_io_id) THEN
    RAISE EXCEPTION 'This assignment was removed from the campaign. Add a new assignment instead.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_removed_campaign_assignment ON public.campaign_lines;
CREATE TRIGGER guard_removed_campaign_assignment BEFORE UPDATE ON public.campaign_lines
  FOR EACH ROW EXECUTE FUNCTION public.guard_removed_campaign_assignment();

-- Serialize new financial links with removal, including requests from a stale browser.
CREATE OR REPLACE FUNCTION public.guard_removed_assignment_financial_link()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_status public.campaign_status;
BEGIN
  IF NEW.campaign_line_id IS NOT NULL THEN
    SELECT status INTO v_status FROM public.campaign_lines WHERE id=NEW.campaign_line_id FOR SHARE;
    IF v_status = 'cancelled' THEN
      RAISE EXCEPTION 'This assignment was removed from the campaign and cannot receive new financial documents.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_removed_assignment_financial_link ON public.invoice_line_items;
CREATE TRIGGER guard_removed_assignment_financial_link
  BEFORE INSERT OR UPDATE OF campaign_line_id ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_removed_assignment_financial_link();
DROP TRIGGER IF EXISTS guard_removed_assignment_financial_link ON public.vendor_io_lines;
CREATE TRIGGER guard_removed_assignment_financial_link
  BEFORE INSERT OR UPDATE OF campaign_line_id ON public.vendor_io_lines
  FOR EACH ROW EXECUTE FUNCTION public.guard_removed_assignment_financial_link();
