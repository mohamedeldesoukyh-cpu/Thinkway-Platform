BEGIN;
-- Both entry points use explicit authorization and see all financial blockers.
CREATE OR REPLACE FUNCTION public.assert_assignment_cancellable(p_line_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.campaign_lines%ROWTYPE;
BEGIN
 SELECT * INTO l FROM public.campaign_lines WHERE id=p_line_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found.'; END IF;
 IF l.invoice_id IS NOT NULL OR l.billing_status NOT IN ('draft','approved','moved_to_billing')
 OR EXISTS(SELECT 1 FROM public.invoice_line_items WHERE campaign_line_id=p_line_id)
 OR EXISTS(SELECT 1 FROM public.invoice_lines WHERE campaign_line_id=p_line_id) THEN
  RAISE EXCEPTION 'This assignment has an invoice or financial posting. Resolve it through the finance correction workflow before cancelling.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.assignment_post_schedule WHERE campaign_line_id=p_line_id AND (status IN ('posted','verified') OR nullif(trim(proof_url),'') IS NOT NULL))
 OR EXISTS(SELECT 1 FROM public.campaign_publications WHERE campaign_line_id=p_line_id) THEN
  RAISE EXCEPTION 'Published work cannot be cancelled through assignment removal. Review the delivered work first.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.creator_payment_entries e JOIN public.campaign_influencers a ON a.id=e.assignment_id WHERE a.campaign_line_id=p_line_id) THEN
  RAISE EXCEPTION 'This assignment has payment records. Resolve them in finance before cancelling.';
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.assert_assignment_cancellable(uuid) FROM PUBLIC,authenticated;

CREATE OR REPLACE FUNCTION public.cancel_vendor_io_preserving_history(p_campaign_id uuid,p_io_id uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.vendor_ios%ROWTYPE; l record; event_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_permission('campaigns.write') OR public.has_permission('vendor_ios.write')) OR NOT public.can_access_campaign_header(p_campaign_id) THEN
  RAISE EXCEPTION 'You do not have permission to cancel this Vendor IO.';
 END IF;
 IF length(trim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'Enter a cancellation reason.'; END IF;
 SELECT * INTO v FROM public.vendor_ios WHERE id=p_io_id AND campaign_header_id=p_campaign_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vendor IO not found.'; END IF;
 IF v.status='cancelled' THEN RETURN; END IF;
 IF v.is_superseded THEN RAISE EXCEPTION 'This IO has already been superseded. Open its current version.'; END IF;
 FOR l IN SELECT DISTINCT cl.id FROM public.campaign_lines cl
 LEFT JOIN public.vendor_io_lines vl ON vl.campaign_line_id=cl.id
 LEFT JOIN public.campaign_influencers ca ON ca.campaign_line_id=cl.id
 WHERE cl.campaign_header_id=p_campaign_id AND (cl.vendor_io_id=p_io_id OR vl.vendor_io_id=p_io_id OR ca.id=v.assignment_id)
 ORDER BY cl.id
 LOOP PERFORM public.assert_assignment_cancellable(l.id); END LOOP;
 IF EXISTS(SELECT 1 FROM public.creator_payment_entries WHERE io_id=p_io_id)
 OR EXISTS(SELECT 1 FROM public.vendor_credit_notes WHERE vendor_io_id=p_io_id)
 OR EXISTS(SELECT 1 FROM public.vendor_debit_notes WHERE vendor_io_id=p_io_id) THEN
  RAISE EXCEPTION 'This IO has payment or finance adjustment records. Resolve them in finance before cancelling.';
 END IF;
 INSERT INTO public.business_change_events(event_type,reason_code,reason_detail,campaign_header_id,entity_type,entity_id,payload,actor_id)
 VALUES('vendor_io_cancelled','vendor_io_cancelled',trim(p_reason),p_campaign_id,'vendor_io',p_io_id,jsonb_build_object('previous_status',v.status,'history_preserved',true),auth.uid()) RETURNING id INTO event_id;
 UPDATE public.vendor_ios SET status='cancelled',approval_token_hash=NULL,lifecycle_reason_code='vendor_io_cancelled',lifecycle_reason_detail=trim(p_reason),lifecycle_changed_at=now(),lifecycle_changed_by=auth.uid(),updated_by=auth.uid() WHERE id=p_io_id;
 INSERT INTO public.document_lifecycle_reactions(business_change_event_id,document_type,document_id,from_status,to_status,reason_code,reason_detail,recommended_actions)
 VALUES(event_id,'vendor_io',p_io_id,v.status,'cancelled','vendor_io_cancelled',trim(p_reason),ARRAY['review_cancellation']);
 -- Preserve IO lines, snapshots, serials, approval evidence and signed files.
 UPDATE public.campaign_lines cl SET vendor_io_id=NULL,operational_status='draft',billing_status='draft',vendor_assignment_locked=false
 WHERE cl.campaign_header_id=p_campaign_id AND cl.status<>'cancelled'
 AND (cl.vendor_io_id=p_io_id OR (cl.vendor_io_id IS NULL AND (
   EXISTS(SELECT 1 FROM public.vendor_io_lines vl WHERE vl.vendor_io_id=p_io_id AND vl.campaign_line_id=cl.id)
   OR EXISTS(SELECT 1 FROM public.campaign_influencers ca WHERE ca.id=v.assignment_id AND ca.campaign_line_id=cl.id)
 )));
END; $$;
REVOKE ALL ON FUNCTION public.cancel_vendor_io_preserving_history(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_vendor_io_preserving_history(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_campaign_assignment(
  p_campaign_id uuid, p_line_id uuid, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

  PERFORM public.assert_assignment_cancellable(p_line_id);
  -- Do not cancel a shared IO behind another active assignment.
  FOR v_io IN SELECT DISTINCT v.* FROM public.vendor_ios v
    LEFT JOIN public.vendor_io_lines vl ON vl.vendor_io_id=v.id
    LEFT JOIN public.campaign_influencers ca ON ca.id=v.assignment_id
    WHERE v.campaign_header_id=p_campaign_id AND v.status <> 'cancelled' AND NOT v.is_superseded
      AND (v.id=v_line.vendor_io_id OR vl.campaign_line_id=p_line_id OR ca.campaign_line_id=p_line_id)
  LOOP
    IF EXISTS (SELECT 1 FROM public.vendor_io_lines x JOIN public.campaign_lines l ON l.id=x.campaign_line_id
      WHERE x.vendor_io_id=v_io.id AND l.id<>p_line_id AND l.status<>'cancelled')
      OR EXISTS (SELECT 1 FROM public.campaign_lines l WHERE l.vendor_io_id=v_io.id AND l.id<>p_line_id AND l.status<>'cancelled')
      OR EXISTS (SELECT 1 FROM public.campaign_influencers ca JOIN public.campaign_lines l ON l.id=ca.campaign_line_id
        WHERE ca.id=v_io.assignment_id AND l.id<>p_line_id AND l.status<>'cancelled') THEN
      RAISE EXCEPTION 'This Vendor IO covers other active assignments. Cancel or revise that IO separately before removing this creator.';
    END IF;
    PERFORM public.cancel_vendor_io_preserving_history(p_campaign_id,v_io.id,p_reason);
  END LOOP;
  UPDATE public.campaign_lines SET billing_status='draft' WHERE id=p_line_id;
  UPDATE public.assignment_post_schedule SET status='cancelled', metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('cancellation_reason',trim(p_reason))
    WHERE campaign_line_id=p_line_id AND status<>'cancelled';
  UPDATE public.assignment_deliverables SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('cancelled',true,'cancellation_reason',trim(p_reason)) WHERE campaign_line_id=p_line_id;
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


-- A cancelled document remains historical and cannot be resent, edited or deleted.
CREATE OR REPLACE FUNCTION public.guard_cancelled_vendor_io() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.status='cancelled' THEN RAISE EXCEPTION 'Cancelled IOs are retained for history and cannot be edited or deleted.'; END IF;
 IF TG_OP='DELETE' AND OLD.status<>'draft' THEN RAISE EXCEPTION 'Issued IOs must be cancelled, not deleted.'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_cancelled_vendor_io ON public.vendor_ios;
CREATE TRIGGER guard_cancelled_vendor_io BEFORE UPDATE OR DELETE ON public.vendor_ios FOR EACH ROW EXECUTE FUNCTION public.guard_cancelled_vendor_io();
-- Cancelled IOs do not reserve the active document slot.
DROP INDEX IF EXISTS public.vendor_ios_active_influencer_campaign_unique;
CREATE UNIQUE INDEX vendor_ios_active_influencer_campaign_unique ON public.vendor_ios(campaign_header_id,influencer_id) WHERE is_superseded=false AND status<>'cancelled';
COMMIT;
