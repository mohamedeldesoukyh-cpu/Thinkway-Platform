BEGIN;
-- Reopen is a correction, not cancellation: keep the issued document and its history.
CREATE OR REPLACE FUNCTION public.assert_vendor_io_reopenable(p_io uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v vendor_ios%ROWTYPE; ids uuid[];
BEGIN
 SELECT * INTO v FROM vendor_ios WHERE id=p_io FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vendor IO not found.'; END IF;
 IF auth.uid() IS NULL OR NOT (has_permission('campaigns.write') OR has_permission('vendor_ios.write')) OR NOT can_access_campaign_header(v.campaign_header_id) THEN
  RAISE EXCEPTION 'You do not have permission to edit this Vendor IO.';
 END IF;
 SELECT array_agg(id) INTO ids FROM campaign_lines WHERE campaign_header_id=v.campaign_header_id AND
 (vendor_io_id=p_io OR metadata->>'pending_vendor_io_id'=p_io::text OR id IN (SELECT campaign_line_id FROM vendor_io_lines WHERE vendor_io_id=p_io));
 IF coalesce(cardinality(ids),0)=0 THEN RAISE EXCEPTION 'No assignments linked to this IO.'; END IF;
 PERFORM id FROM campaign_lines WHERE id=ANY(ids) ORDER BY id FOR UPDATE;
 -- Payment writes also lock the assignment, so a payment cannot race reopening.
 PERFORM id FROM campaign_influencers WHERE id=v.assignment_id OR campaign_line_id=ANY(ids) ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM creator_payment_entries e WHERE (e.io_id=p_io OR e.assignment_id=v.assignment_id OR e.assignment_id IN (SELECT id FROM campaign_influencers WHERE campaign_line_id=ANY(ids))) AND e.status IN ('paid','exported') AND e.cleared_at IS NULL)
 OR EXISTS(SELECT 1 FROM campaign_influencers WHERE (id=v.assignment_id OR campaign_line_id=ANY(ids)) AND vendor_payment_status='paid') THEN
  RAISE EXCEPTION 'Payment is recorded or pending. Edit and clear the payment first, then ungenerate the Vendor IO.';
 END IF;
 IF EXISTS(SELECT 1 FROM vendor_credit_notes WHERE vendor_io_id=p_io) OR EXISTS(SELECT 1 FROM vendor_debit_notes WHERE vendor_io_id=p_io) THEN
  RAISE EXCEPTION 'Resolve the Vendor IO finance adjustments before reopening it.';
 END IF;
 IF EXISTS(SELECT 1 FROM invoices i WHERE (i.id IN (SELECT invoice_id FROM campaign_lines WHERE id=ANY(ids)) OR i.id IN (SELECT invoice_id FROM invoice_line_items WHERE campaign_line_id=ANY(ids)) OR i.id IN (SELECT invoice_id FROM invoice_lines WHERE campaign_line_id=ANY(ids))) AND (i.amount_paid>0 OR i.issue_date IS NOT NULL OR i.amounts_finalized_at IS NOT NULL OR i.status<>'draft' OR i.is_operational_locked)) THEN
  RAISE EXCEPTION 'An issued or locked client invoice covers this assignment. Resolve it through the finance correction workflow first.';
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.assert_vendor_io_reopenable(uuid) FROM PUBLIC,authenticated;

CREATE OR REPLACE FUNCTION public.reopen_vendor_ios_for_edit(p_campaign uuid,p_ios uuid[],p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v vendor_ios%ROWTYPE; ids uuid[];
BEGIN
 IF coalesce(cardinality(p_ios),0)=0 OR length(trim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'Choose an IO and enter a correction reason.'; END IF;
 IF (SELECT count(*) FROM vendor_ios WHERE id=ANY(p_ios) AND campaign_header_id=p_campaign)<>(SELECT count(DISTINCT x) FROM unnest(p_ios) x) THEN RAISE EXCEPTION 'Vendor IO campaign mismatch.'; END IF;
 FOR v IN SELECT * FROM vendor_ios WHERE id=ANY(p_ios) ORDER BY id FOR UPDATE LOOP
  PERFORM assert_vendor_io_reopenable(v.id);
  IF v.is_superseded OR v.status='cancelled' THEN RAISE EXCEPTION 'Open the current Vendor IO version.'; END IF;
  SELECT array_agg(id) INTO ids FROM campaign_lines WHERE campaign_header_id=p_campaign AND (vendor_io_id=v.id OR id IN (SELECT campaign_line_id FROM vendor_io_lines WHERE vendor_io_id=v.id));
  INSERT INTO business_change_events(event_type,reason_code,reason_detail,campaign_header_id,entity_type,entity_id,payload,actor_id)
  VALUES('vendor_io_reopened','vendor_io_reopened',trim(p_reason),p_campaign,'vendor_io',v.id,jsonb_build_object('previous_io',to_jsonb(v),'assignment_ids',ids),auth.uid());
  UPDATE vendor_ios SET is_superseded=true,approval_token_hash=NULL,lifecycle_reason_code='pending_regeneration',lifecycle_reason_detail=trim(p_reason),lifecycle_changed_at=now(),lifecycle_changed_by=auth.uid(),updated_by=auth.uid() WHERE id=v.id;
  UPDATE campaign_lines SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('pending_vendor_io_id',v.id),vendor_io_id=NULL,invoice_id=NULL,operational_status='draft',billing_status='draft',cost_locked=false,revenue_locked=false,vat_locked=false,vendor_assignment_locked=false WHERE id=ANY(ids);
  DELETE FROM vendor_io_lines WHERE vendor_io_id=v.id;
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.reopen_vendor_ios_for_edit(uuid,uuid[],text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reopen_vendor_ios_for_edit(uuid,uuid[],text) TO authenticated;

CREATE OR REPLACE FUNCTION public.regenerate_reopened_vendor_io(p_io uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v vendor_ios%ROWTYPE; ids uuid[]; next_id uuid; n integer; c text; total numeric;
BEGIN
 SELECT * INTO v FROM vendor_ios WHERE id=p_io FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original Vendor IO not found.'; END IF;
 PERFORM assert_vendor_io_reopenable(p_io);
 IF NOT v.is_superseded OR v.lifecycle_reason_code<>'pending_regeneration' THEN RAISE EXCEPTION 'This IO is not awaiting regeneration.'; END IF;
 SELECT array_agg(id),min(currency_code),sum(coalesce(cost_before_vat,cost,0)) INTO ids,c,total FROM campaign_lines WHERE campaign_header_id=v.campaign_header_id AND metadata->>'pending_vendor_io_id'=p_io::text;
 IF coalesce(cardinality(ids),0)=0 THEN RAISE EXCEPTION 'No reopened assignments found.'; END IF;
 IF (SELECT count(DISTINCT currency_code) FROM campaign_lines WHERE id=ANY(ids))<>1 THEN RAISE EXCEPTION 'Assignments in one Vendor IO must use the same currency.'; END IF;
 IF EXISTS(SELECT 1 FROM campaign_lines WHERE id=ANY(ids) AND (vendor_io_id IS NOT NULL OR status='cancelled')) THEN RAISE EXCEPTION 'Assignment state changed. Refresh before generating.'; END IF;
 SELECT coalesce(max(revision_number),0)+1 INTO n FROM vendor_ios WHERE id=coalesce(v.root_vendor_io_id,v.id) OR root_vendor_io_id=coalesce(v.root_vendor_io_id,v.id);
 INSERT INTO vendor_ios(assignment_id,campaign_header_id,influencer_id,amount,currency_code,status,terms_text,terms_html,usage_rights,exclusivity,compliance_country_code,special_payment_terms,created_by,updated_by,revision_number,document_number,replaces_vendor_io_id,root_vendor_io_id,is_superseded)
 VALUES(v.assignment_id,v.campaign_header_id,v.influencer_id,total,c,'draft',v.terms_text,v.terms_html,v.usage_rights,v.exclusivity,v.compliance_country_code,v.special_payment_terms,auth.uid(),auth.uid(),n,regexp_replace(v.document_number,'/[0-9]+$','')||'/'||n,p_io,coalesce(v.root_vendor_io_id,v.id),false) RETURNING id INTO next_id;
 INSERT INTO vendor_io_lines(vendor_io_id,campaign_line_id) SELECT next_id,unnest(ids);
 UPDATE campaign_lines SET vendor_io_id=next_id,metadata=metadata-'pending_vendor_io_id',operational_status='io_generated',billing_status='moved_to_billing' WHERE id=ANY(ids);
 UPDATE vendor_ios SET lifecycle_reason_code='superseded',updated_by=auth.uid() WHERE id=p_io;
 INSERT INTO business_change_events(event_type,reason_code,reason_detail,campaign_header_id,entity_type,entity_id,payload,actor_id)
 VALUES('vendor_io_regenerated','vendor_io_regenerated',v.lifecycle_reason_detail,v.campaign_header_id,'vendor_io',next_id,jsonb_build_object('previous_io_id',p_io,'amount',total,'currency',c),auth.uid());
 RETURN next_id;
END; $$;
REVOKE ALL ON FUNCTION public.regenerate_reopened_vendor_io(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_reopened_vendor_io(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.vendor_io_reopen_eligibility(p_ios uuid[])
RETURNS TABLE(io_id uuid,eligible boolean,reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE x uuid;
BEGIN
 FOREACH x IN ARRAY p_ios LOOP
  io_id:=x; eligible:=false; reason:=NULL;
  BEGIN
   PERFORM assert_vendor_io_reopenable(x);
   IF EXISTS(SELECT 1 FROM vendor_ios WHERE id=x AND (is_superseded OR status='cancelled')) THEN
    RAISE EXCEPTION 'Open the current Vendor IO version.';
   END IF;
   eligible:=true;
  EXCEPTION WHEN OTHERS THEN reason:=SQLERRM;
  END;
  RETURN NEXT;
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.vendor_io_reopen_eligibility(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_io_reopen_eligibility(uuid[]) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
