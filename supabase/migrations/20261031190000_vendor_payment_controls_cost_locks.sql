BEGIN;
-- Vendor-side locks are derived from current payments, never client invoices.
CREATE OR REPLACE FUNCTION public.assignment_vendor_payment_locked(p_line uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (
  SELECT 1 FROM creator_payment_entries e
  WHERE e.status='paid' AND e.cleared_at IS NULL AND e.original_amount>0
  AND (e.assignment_id IN (SELECT id FROM campaign_influencers WHERE campaign_line_id=p_line)
    OR e.io_id IN (SELECT vendor_io_id FROM vendor_io_lines WHERE campaign_line_id=p_line
      UNION SELECT vendor_io_id FROM campaign_lines WHERE id=p_line
      UNION SELECT (metadata->>'pending_vendor_io_id')::uuid FROM campaign_lines WHERE id=p_line))
 ) OR EXISTS (
  SELECT 1 FROM campaign_influencers a WHERE a.campaign_line_id=p_line AND a.vendor_payment_status='paid'
  AND NOT EXISTS (SELECT 1 FROM creator_payment_entries e WHERE e.assignment_id=a.id)
 );
$$;
REVOKE ALL ON FUNCTION public.assignment_vendor_payment_locked(uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.assert_assignment_vendor_unpaid(p_line uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE campaign uuid;
BEGIN
 SELECT campaign_header_id INTO campaign FROM campaign_lines WHERE id=p_line FOR UPDATE;
 IF auth.uid() IS NULL OR campaign IS NULL OR NOT can_access_campaign_header(campaign)
 OR NOT (has_permission('campaigns.write') OR has_permission('vendor_ios.write')) THEN
 RAISE EXCEPTION 'You do not have permission to edit this assignment.'; END IF;
 PERFORM id FROM campaign_influencers WHERE campaign_line_id=p_line ORDER BY id FOR UPDATE;
 IF assignment_vendor_payment_locked(p_line) THEN
 RAISE EXCEPTION 'Vendor payment is recorded. Set the payment to zero in Payments before editing costs or Vendor IOs.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.assert_assignment_vendor_unpaid(uuid) FROM PUBLIC;


CREATE OR REPLACE FUNCTION public.assignment_document_locks(p_line uuid)
RETURNS TABLE(cost_locked boolean, client_locked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT assignment_vendor_payment_locked(p_line), EXISTS(
   SELECT 1 FROM invoices i WHERE i.status::text NOT IN ('void','cancelled','voided')
   AND coalesce(i.regeneration_status,'active')<>'pending_regeneration'
   AND (i.id IN (SELECT invoice_id FROM campaign_lines WHERE id=p_line)
     OR i.id IN (SELECT invoice_id FROM invoice_line_items_operational WHERE campaign_line_id=p_line)
     OR i.id IN (SELECT invoice_id FROM invoice_lines WHERE campaign_line_id=p_line))
 );
$$;

CREATE OR REPLACE FUNCTION public.guard_assignment_document_commercials()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE before_row jsonb:=to_jsonb(OLD); after_row jsonb:=to_jsonb(NEW);
 line_id uuid; locks record; key text; client_changed boolean:=false; cost_changed boolean:=false;
BEGIN
 FOREACH key IN ARRAY ARRAY['revenue','revenue_before_vat','unit_revenue','revenue_per_post',
   'usage_rights_amount','agency_fee_percent','agency_fee_amount','revenue_vat_percent','revenue_vat_exempt',
   'revenue_fx_override','currency_code','quantity'] LOOP
   client_changed:=client_changed OR (before_row->key IS DISTINCT FROM after_row->key);
 END LOOP;
 FOREACH key IN ARRAY ARRAY['cost','cost_before_vat','unit_cost','cost_per_post','cost_received',
   'cost_received_currency','usage_rights_cost','cost_vat_percent','cost_vat_exempt','cost_fx_override',
   'fx_rate','fx_from_currency','fx_to_currency','currency_code','quantity'] LOOP
   cost_changed:=cost_changed OR (before_row->key IS DISTINCT FROM after_row->key);
 END LOOP;
 IF NOT client_changed AND NOT cost_changed THEN RETURN NEW; END IF;
 line_id:=CASE WHEN TG_TABLE_NAME='campaign_lines' THEN OLD.id ELSE (before_row->>'campaign_line_id')::uuid END;
 IF cost_changed THEN
   PERFORM id FROM campaign_influencers WHERE campaign_line_id=line_id ORDER BY id FOR UPDATE;
 END IF;
 SELECT * INTO locks FROM assignment_document_locks(line_id);
 IF client_changed AND locks.client_locked THEN
   RAISE EXCEPTION 'Client amounts, currency, fees, VAT and FX are locked. Ungenerate the linked client invoice before editing the client side.' USING ERRCODE='check_violation';
 END IF;
 IF cost_changed AND locks.cost_locked THEN
   RAISE EXCEPTION 'Vendor payment is recorded. Set the payment to zero in Payments before editing costs.' USING ERRCODE='check_violation';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_campaign_line_billing_lock()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_override_active boolean; v_vendor_correction boolean; v_cost_changed boolean;
BEGIN
  v_override_active := NEW.finance_override_until IS NOT NULL
    AND NEW.finance_override_until > timezone('utc', now());

  v_vendor_correction := OLD.metadata->>'pending_vendor_io_id' IS NOT NULL AND NOT OLD.cost_locked
    AND EXISTS(SELECT 1 FROM public.vendor_ios WHERE id::text=OLD.metadata->>'pending_vendor_io_id'
      AND campaign_header_id=OLD.campaign_header_id AND is_superseded AND lifecycle_reason_code='pending_regeneration');
  IF v_vendor_correction THEN
    PERFORM public.assert_vendor_io_reopenable((OLD.metadata->>'pending_vendor_io_id')::uuid);
  END IF;
  IF OLD.revenue_locked AND NEW.revenue IS DISTINCT FROM OLD.revenue AND NOT v_override_active THEN
    RAISE EXCEPTION 'Revenue is locked on invoiced line %. Finance override required.', OLD.document_number
      USING ERRCODE = 'check_violation';
  END IF;

  v_cost_changed := (NEW.cost, NEW.cost_before_vat, NEW.usage_rights_cost, NEW.cost_vat_percent, NEW.cost_vat_exempt)
    IS DISTINCT FROM (OLD.cost, OLD.cost_before_vat, OLD.usage_rights_cost, OLD.cost_vat_percent, OLD.cost_vat_exempt);
  IF v_cost_changed THEN
    PERFORM id FROM campaign_influencers WHERE campaign_line_id=OLD.id ORDER BY id FOR UPDATE;
    IF assignment_vendor_payment_locked(OLD.id) THEN
      RAISE EXCEPTION 'Vendor payment is recorded. Set the payment to zero before changing costs.';
    END IF;
  END IF;

  IF OLD.vat_locked AND NOT v_override_active THEN
    IF NEW.revenue_vat_percent IS DISTINCT FROM OLD.revenue_vat_percent
      OR NEW.revenue_vat_exempt IS DISTINCT FROM OLD.revenue_vat_exempt
      OR NEW.revenue_before_vat IS DISTINCT FROM OLD.revenue_before_vat
 THEN
      RAISE EXCEPTION 'VAT is locked on invoiced line %. Finance override required.', OLD.document_number
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.invoice_id IS NOT NULL AND OLD.invoice_id IS NULL THEN
    NEW.vat_locked := true;
  END IF;

  IF NEW.invoice_id IS NULL AND OLD.invoice_id IS NOT NULL AND NOT v_override_active THEN
    NEW.vat_locked := false;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_assignment_cost_vat() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; paid numeric; reserved numeric; effective_rate numeric; total numeric;
BEGIN
 IF (NEW.cost_vat_percent,NEW.cost_vat_exempt) IS NOT DISTINCT FROM (OLD.cost_vat_percent,OLD.cost_vat_exempt) THEN RETURN NEW; END IF;
 IF OLD.metadata->>'pending_vendor_io_id' IS NOT NULL AND NOT OLD.cost_locked THEN
   PERFORM assert_vendor_io_reopenable((OLD.metadata->>'pending_vendor_io_id')::uuid);
   IF EXISTS(SELECT 1 FROM vendor_ios WHERE id::text=OLD.metadata->>'pending_vendor_io_id' AND is_superseded AND lifecycle_reason_code='pending_regeneration') THEN
     effective_rate:=CASE WHEN NEW.cost_vat_exempt THEN 0 ELSE coalesce(NEW.cost_vat_percent,0) END;
     UPDATE assignment_deliverables SET cost_vat_percent=effective_rate,cost_vat_exempt=NEW.cost_vat_exempt,cost_vat_amount=round(cost_before_vat*effective_rate/100,2),cost_after_vat=cost_before_vat+round(cost_before_vat*effective_rate/100,2) WHERE campaign_line_id=NEW.id;
     UPDATE assignment_post_schedule SET cost_vat_percent=effective_rate,cost_vat_amount=round(cost_before_vat*effective_rate/100,2) WHERE campaign_line_id=NEW.id;
     RETURN NEW;
   END IF;
 END IF;
 IF assignment_vendor_payment_locked(OLD.id) THEN
   RAISE EXCEPTION 'Vendor payment is recorded. Set the payment to zero before changing cost VAT';
 END IF;
 effective_rate:=CASE WHEN NEW.cost_vat_exempt THEN 0 ELSE coalesce(NEW.cost_vat_percent,0) END;
 total:=NEW.cost_before_vat+round(NEW.cost_before_vat*effective_rate/100,2);
 FOR a IN SELECT * FROM campaign_influencers WHERE campaign_line_id=NEW.id ORDER BY id FOR UPDATE LOOP
   SELECT coalesce(sum(original_amount) FILTER(WHERE status='paid' AND cleared_at IS NULL),0),coalesce(sum(original_amount) FILTER(WHERE status='exported' AND cleared_at IS NULL),0)
     INTO paid,reserved FROM creator_payment_entries WHERE assignment_id=a.id;
   IF reserved>0 THEN RAISE EXCEPTION 'Confirm pending bank results before changing cost VAT'; END IF;
   IF paid>total THEN RAISE EXCEPTION 'Cost VAT correction makes total fees lower than recorded payments. Revise payment records first'; END IF;
   UPDATE creator_payment_terms SET fee=NEW.cost_before_vat,vat=effective_rate,updated_at=now(),updated_by=coalesce(auth.uid(),updated_by) WHERE assignment_id=a.id;
   UPDATE campaign_influencers SET cost_before_vat=NEW.cost_before_vat,cost_vat_percent=effective_rate,cost_vat_amount=round(NEW.cost_before_vat*effective_rate/100,2),cost_after_vat=total,
     vendor_payment_status=CASE WHEN EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=a.id) THEN (CASE WHEN paid>=total THEN 'paid' WHEN paid>0 THEN 'pending' ELSE 'unpaid' END)::public.vendor_payment_status ELSE vendor_payment_status END,
     vendor_paid_at=CASE WHEN EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=a.id) AND paid<total THEN NULL ELSE vendor_paid_at END
     WHERE id=a.id;
 END LOOP;
 -- Update only tax fields: keep IDs, schedules, publication links and billing history.
 UPDATE assignment_deliverables SET cost_vat_percent=effective_rate,cost_vat_exempt=NEW.cost_vat_exempt,
   cost_vat_amount=round(cost_before_vat*effective_rate/100,2),cost_after_vat=cost_before_vat+round(cost_before_vat*effective_rate/100,2)
   WHERE campaign_line_id=NEW.id;
 UPDATE assignment_post_schedule SET cost_vat_percent=effective_rate,cost_vat_amount=round(cost_before_vat*effective_rate/100,2)
   WHERE campaign_line_id=NEW.id;
 RETURN NEW;
END $$;

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
 IF EXISTS(SELECT 1 FROM unnest(ids) x WHERE assignment_vendor_payment_locked(x)) THEN
  RAISE EXCEPTION 'Vendor payment is recorded. Set the payment to zero in Payments before changing Vendor IOs.';
 END IF;
 IF EXISTS(SELECT 1 FROM vendor_credit_notes WHERE vendor_io_id=p_io) OR EXISTS(SELECT 1 FROM vendor_debit_notes WHERE vendor_io_id=p_io) THEN
  RAISE EXCEPTION 'Resolve the Vendor IO finance adjustments before reopening it.';
 END IF;
END; $$;

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
  UPDATE campaign_lines SET metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('pending_vendor_io_id',v.id),vendor_io_id=NULL,operational_status=CASE WHEN invoice_id IS NULL THEN 'draft' ELSE operational_status END,cost_locked=false,revenue_locked=CASE WHEN invoice_id IS NOT NULL THEN true ELSE revenue_locked END,vendor_assignment_locked=false WHERE id=ANY(ids);
  DELETE FROM vendor_io_lines WHERE vendor_io_id=v.id;
 END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.regenerate_reopened_vendor_io(p_io uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v vendor_ios%ROWTYPE; ids uuid[]; next_id uuid; n integer; c text; total numeric;
BEGIN
 SELECT * INTO v FROM vendor_ios WHERE id=p_io FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original Vendor IO not found.'; END IF;
 PERFORM assert_vendor_io_reopenable(p_io);
 IF NOT v.is_superseded OR v.lifecycle_reason_code<>'pending_regeneration' THEN RAISE EXCEPTION 'This IO is not awaiting regeneration.'; END IF;
 SELECT array_agg(id),min(CASE WHEN metadata->>'vendor_native_cost'='true' THEN cost_received_currency ELSE currency_code END),sum(CASE WHEN metadata->>'vendor_native_cost'='true' THEN cost_received ELSE coalesce(cost_before_vat,cost,0) END) INTO ids,c,total FROM campaign_lines WHERE campaign_header_id=v.campaign_header_id AND metadata->>'pending_vendor_io_id'=p_io::text;
 IF coalesce(cardinality(ids),0)=0 THEN RAISE EXCEPTION 'No reopened assignments found.'; END IF;
 IF (SELECT count(DISTINCT CASE WHEN metadata->>'vendor_native_cost'='true' THEN cost_received_currency ELSE currency_code END) FROM campaign_lines WHERE id=ANY(ids))<>1 THEN RAISE EXCEPTION 'Assignments in one Vendor IO must use the same currency.'; END IF;
 IF EXISTS(SELECT 1 FROM campaign_lines WHERE id=ANY(ids) AND (vendor_io_id IS NOT NULL OR status='cancelled')) THEN RAISE EXCEPTION 'Assignment state changed. Refresh before generating.'; END IF;
 SELECT coalesce(max(revision_number),0)+1 INTO n FROM vendor_ios WHERE id=coalesce(v.root_vendor_io_id,v.id) OR root_vendor_io_id=coalesce(v.root_vendor_io_id,v.id);
 INSERT INTO vendor_ios(assignment_id,campaign_header_id,influencer_id,amount,currency_code,status,terms_text,terms_html,usage_rights,exclusivity,compliance_country_code,special_payment_terms,created_by,updated_by,revision_number,document_number,replaces_vendor_io_id,root_vendor_io_id,is_superseded)
 VALUES(v.assignment_id,v.campaign_header_id,v.influencer_id,total,c,'draft',v.terms_text,v.terms_html,v.usage_rights,v.exclusivity,v.compliance_country_code,v.special_payment_terms,auth.uid(),auth.uid(),n,regexp_replace(v.document_number,'/[0-9]+$','')||'/'||n,p_io,coalesce(v.root_vendor_io_id,v.id),false) RETURNING id INTO next_id;
 INSERT INTO vendor_io_lines(vendor_io_id,campaign_line_id) SELECT next_id,unnest(ids);
 UPDATE campaign_lines SET vendor_io_id=next_id,metadata=metadata-'pending_vendor_io_id',operational_status=CASE WHEN invoice_id IS NULL THEN 'io_generated' ELSE operational_status END,billing_status=CASE WHEN invoice_id IS NULL THEN 'moved_to_billing' ELSE billing_status END WHERE id=ANY(ids);
 UPDATE vendor_ios SET lifecycle_reason_code='superseded',updated_by=auth.uid() WHERE id=p_io;
 INSERT INTO business_change_events(event_type,reason_code,reason_detail,campaign_header_id,entity_type,entity_id,payload,actor_id)
 VALUES('vendor_io_regenerated','vendor_io_regenerated',v.lifecycle_reason_detail,v.campaign_header_id,'vendor_io',next_id,jsonb_build_object('previous_io_id',p_io,'amount',total,'currency',c),auth.uid());
 RETURN next_id;
END; $$;

CREATE OR REPLACE FUNCTION public.update_reopened_vendor_cost(p_line uuid,p_cost numeric,p_usage_cost numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l campaign_lines%ROWTYPE; old_io uuid; a record; rate numeric; fee_amount numeric;
BEGIN
 PERFORM assert_assignment_vendor_unpaid(p_line);
 SELECT * INTO STRICT l FROM campaign_lines WHERE id=p_line FOR UPDATE;
 IF l.status='cancelled' THEN RAISE EXCEPTION 'Assignment is cancelled.'; END IF;
 IF l.vendor_io_id IS NOT NULL THEN
   PERFORM reopen_vendor_ios_for_edit(l.campaign_header_id,ARRAY[l.vendor_io_id],'Vendor cost correction');
 END IF;
 IF p_cost IS NULL OR p_cost<0 OR p_usage_cost IS NULL OR p_usage_cost<0 THEN RAISE EXCEPTION 'Cost must be zero or greater.'; END IF;
 rate:=CASE WHEN l.cost_vat_exempt THEN 0 ELSE coalesce(l.cost_vat_percent,0) END;
 UPDATE campaign_lines SET cost_before_vat=p_cost,cost=p_cost,usage_rights_cost=p_usage_cost,
   cost_received=CASE WHEN coalesce(cost_received_currency,currency_code)=currency_code THEN p_cost ELSE p_cost/nullif(fx_rate,0) END
 WHERE id=p_line;
 SELECT CASE WHEN metadata->>'vendor_native_cost'='true' THEN cost_received ELSE p_cost END INTO fee_amount FROM campaign_lines WHERE id=p_line;
 FOR a IN SELECT id FROM campaign_influencers WHERE campaign_line_id=p_line ORDER BY id FOR UPDATE LOOP
  UPDATE campaign_influencers SET cost_before_vat=fee_amount,cost_vat_percent=rate,
    cost_vat_amount=round(fee_amount*rate/100,2),cost_after_vat=fee_amount+round(fee_amount*rate/100,2)
    WHERE id=a.id;
  UPDATE creator_payment_terms SET fee=fee_amount,vat=rate,updated_at=now(),updated_by=auth.uid() WHERE assignment_id=a.id;
 END LOOP;
 -- Retain child IDs, invoice links, schedules and revenue; redistribute only costs.
 WITH weights AS (
  SELECT id,quantity,CASE WHEN sum(cost_before_vat) OVER()>0 THEN cost_before_vat ELSE quantity END w
  FROM assignment_deliverables WHERE campaign_line_id=p_line
 ), shares AS (
  SELECT id,quantity,w,sum(w) OVER(ORDER BY id) running,sum(w) OVER() total FROM weights
 ), amounts AS (
  SELECT id,quantity,round(p_cost*running/total,2)-round(p_cost*(running-w)/total,2) cost,
   round(p_usage_cost*running/total,2)-round(p_usage_cost*(running-w)/total,2) ur FROM shares
 ) UPDATE assignment_deliverables d SET cost_before_vat=x.cost,total_cost=x.cost,unit_cost=round(x.cost/x.quantity,2),
   usage_rights_cost=x.ur,cost_vat_amount=round(x.cost*rate/100,2),cost_after_vat=x.cost+round(x.cost*rate/100,2)
   FROM amounts x WHERE d.id=x.id;
 WITH shares AS (
  SELECT p.id,d.cost_before_vat cost,row_number() OVER(PARTITION BY d.id ORDER BY p.id)::numeric n,
   count(*) OVER(PARTITION BY d.id)::numeric total
  FROM assignment_post_schedule p JOIN assignment_deliverables d ON d.id=p.assignment_deliverable_id
  WHERE p.campaign_line_id=p_line
 ), amounts AS (
  SELECT id,round(cost*n/total,2)-round(cost*(n-1)/total,2) cost FROM shares
 ) UPDATE assignment_post_schedule p SET cost_before_vat=x.cost,cost_vat_amount=round(x.cost*rate/100,2)
   FROM amounts x WHERE p.id=x.id;
 INSERT INTO business_change_events(event_type,reason_code,reason_detail,campaign_header_id,entity_type,entity_id,payload,actor_id)
 VALUES('vendor_cost_corrected','creator_price_changed','Vendor cost corrected while preserving client invoice',l.campaign_header_id,'campaign_line',p_line,
 jsonb_build_object('previous_cost',l.cost_before_vat,'cost',p_cost,'previous_usage_cost',l.usage_rights_cost,'usage_cost',p_usage_cost,'invoice_id',l.invoice_id),auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.update_reopened_vendor_cost_side(
 p_campaign uuid,p_line uuid,p_currency text,p_cost numeric,p_usage_cost numeric,p_vat numeric,p_fx text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l campaign_lines%ROWTYPE; old_io uuid; cost_rate numeric; rev_rate numeric; cross_rate numeric; a record;
BEGIN
 PERFORM assert_assignment_vendor_unpaid(p_line);
 SELECT * INTO STRICT l FROM campaign_lines WHERE id=p_line AND campaign_header_id=p_campaign FOR UPDATE;
 IF l.status='cancelled' THEN RAISE EXCEPTION 'Assignment is cancelled.'; END IF;
 IF l.vendor_io_id IS NOT NULL THEN
   PERFORM reopen_vendor_ios_for_edit(p_campaign,ARRAY[l.vendor_io_id],'Vendor cost correction');
 END IF;
 IF p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' OR p_cost IS NULL OR p_cost<0 OR p_cost::text IN ('NaN','Infinity')
 OR p_usage_cost IS NULL OR p_usage_cost<0 OR p_usage_cost::text IN ('NaN','Infinity') OR p_vat IS NULL OR p_vat<0 OR p_vat>100
 OR NOT valid_creator_fx(p_fx) OR (p_fx IS NOT NULL AND (p_fx::jsonb->>'from')<>p_currency) THEN
  RAISE EXCEPTION 'Enter a valid cost, currency, VAT and FX rate.';
 END IF;
 cost_rate:=creator_fx_rate(p_fx,p_currency,'EGP',resolve_effective_exchange_rate(p_currency::char(3),'EGP'::char(3)),1);
 rev_rate:=creator_fx_rate(l.revenue_fx_override,l.currency_code,'EGP',resolve_effective_exchange_rate(l.currency_code::char(3),'EGP'::char(3)),1);
 IF cost_rate IS NULL OR cost_rate<=0 OR rev_rate IS NULL OR rev_rate<=0 THEN RAISE EXCEPTION 'Exchange rate unavailable.'; END IF;
 cross_rate:=CASE WHEN p_currency=l.currency_code THEN 1 ELSE cost_rate/rev_rate END;
 -- Only vendor-side fields are writable. Issued invoice, revenue currency and FX remain frozen.
 UPDATE campaign_lines SET cost_received_currency=p_currency,cost_fx_override=p_fx,fx_rate=cross_rate,
 fx_from_currency=p_currency,fx_to_currency=l.currency_code,fx_snapshot_at=now(),
 fx_cost_revenue_cross_rate=cross_rate,cost_vat_percent=p_vat,cost_vat_exempt=(p_vat=0),
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('vendor_native_cost',true)
 WHERE id=p_line;
 PERFORM update_reopened_vendor_cost(p_line,round(p_cost*cross_rate,2),round(p_usage_cost*cross_rate,2));
 UPDATE campaign_lines SET cost_received=round(p_cost,2),fx_cost_revenue_cross_rate=cross_rate WHERE id=p_line;
 FOR a IN SELECT id FROM campaign_influencers WHERE campaign_line_id=p_line ORDER BY id FOR UPDATE LOOP
  INSERT INTO business_change_events(event_type,reason_code,reason_detail,campaign_header_id,entity_type,entity_id,payload,actor_id)
  VALUES('vendor_cost_side_corrected','creator_price_changed','Vendor currency, cost, VAT and FX corrected; client invoice preserved',p_campaign,'campaign_line',p_line,
   jsonb_build_object('previous_cost',l.cost_received,'previous_currency',l.cost_received_currency,'previous_fx',l.cost_fx_override,
   'cost',p_cost,'currency',p_currency,'fx',p_fx,'vat',p_vat,'previous_payment_plan',(SELECT draft FROM creator_payment_plans WHERE assignment_id=a.id)),auth.uid());
  UPDATE campaign_influencers SET currency=p_currency,agreed_fee=round(p_cost,2),cost_before_vat=round(p_cost,2),cost_vat_percent=p_vat,
   cost_vat_amount=round(p_cost*p_vat/100,2),cost_after_vat=round(p_cost,2)+round(p_cost*p_vat/100,2) WHERE id=a.id;
  UPDATE creator_payment_terms SET fee=round(p_cost,2),vat=p_vat,updated_at=now(),updated_by=auth.uid() WHERE assignment_id=a.id;
  -- Saved preparation is invalidated; paid/cleared history is retained untouched.
  DELETE FROM creator_payment_plans WHERE assignment_id=a.id;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.guard_vendor_io_payment_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM id FROM campaign_influencers WHERE campaign_line_id=NEW.campaign_line_id ORDER BY id FOR UPDATE;
 IF assignment_vendor_payment_locked(NEW.campaign_line_id) THEN
   RAISE EXCEPTION 'Vendor payment is recorded. Set the payment to zero before generating a Vendor IO.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_vendor_io_payment_link BEFORE INSERT OR UPDATE ON public.vendor_io_lines
 FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_io_payment_link();
CREATE OR REPLACE FUNCTION public.update_unpaid_vendor_cost(p_line uuid,p_cost numeric,p_usage_cost numeric,p_vat numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l campaign_lines%ROWTYPE;
BEGIN
 PERFORM assert_assignment_vendor_unpaid(p_line);
 SELECT * INTO STRICT l FROM campaign_lines WHERE id=p_line FOR UPDATE;
 IF p_vat IS NULL OR p_vat<0 OR p_vat>100 OR p_vat::text='NaN' THEN RAISE EXCEPTION 'Invalid cost VAT'; END IF;
 IF l.vendor_io_id IS NOT NULL THEN
   PERFORM reopen_vendor_ios_for_edit(l.campaign_header_id,ARRAY[l.vendor_io_id],'Vendor cost correction');
 END IF;
 UPDATE campaign_lines SET cost_vat_percent=p_vat,cost_vat_exempt=(p_vat=0) WHERE id=p_line;
 PERFORM update_reopened_vendor_cost(p_line,p_cost,p_usage_cost);
END $$;
REVOKE ALL ON FUNCTION public.update_unpaid_vendor_cost(uuid,numeric,numeric,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_unpaid_vendor_cost(uuid,numeric,numeric,numeric) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_vendor_io_paid_commercials() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE line uuid;
BEGIN
 IF TG_OP='UPDATE' AND (NEW.amount,NEW.currency_code,NEW.assignment_id,NEW.influencer_id,NEW.terms_text,NEW.terms_html,NEW.is_superseded)
  IS NOT DISTINCT FROM (OLD.amount,OLD.currency_code,OLD.assignment_id,OLD.influencer_id,OLD.terms_text,OLD.terms_html,OLD.is_superseded)
  AND NEW.status::text NOT IN ('cancelled','void','voided') THEN RETURN NEW; END IF;
 FOR line IN SELECT campaign_line_id FROM campaign_influencers WHERE id=NEW.assignment_id
 UNION SELECT campaign_line_id FROM vendor_io_lines WHERE vendor_io_id=NEW.id LOOP
   PERFORM id FROM campaign_influencers WHERE campaign_line_id=line ORDER BY id FOR UPDATE;
   IF assignment_vendor_payment_locked(line) THEN
    RAISE EXCEPTION 'Vendor payment is recorded. Set the payment to zero before changing the Vendor IO.';
   END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_vendor_io_paid_commercials BEFORE INSERT OR UPDATE ON public.vendor_ios
 FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_io_paid_commercials();
CREATE OR REPLACE FUNCTION public.apply_assignment_commercial_cost(p_line uuid,p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE prior campaign_lines%ROWTYPE; updated campaign_lines%ROWTYPE; patch jsonb; assignments text;
 rate numeric; cross_rate numeric; native_cost numeric; assignment_row record; rows_json jsonb;
BEGIN
 SELECT * INTO STRICT prior FROM campaign_lines WHERE id=p_line FOR UPDATE;
 IF auth.uid() IS NULL OR NOT (has_permission('campaigns.write') OR has_permission('campaigns.admin') OR has_permission('approvals.decide')) OR NOT can_access_campaign_header(prior.campaign_header_id) THEN
   RAISE EXCEPTION 'You do not have permission to change this assignment.';
 END IF;
 IF jsonb_typeof(p_patch)<>'object' OR p_patch IS NULL THEN RAISE EXCEPTION 'Commercial patch required'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN
 ('cost','cost_before_vat','revenue','revenue_before_vat','po_amount','currency_code','fx_rate','agency_fee_percent','agency_fee_amount','pricing_mode','markup_margin','profit','profit_margin','usage_rights_amount','usage_rights_cost','cost_vat_percent','cost_vat_exempt','revenue_vat_percent','revenue_vat_exempt','cost_fx_override','revenue_fx_override')) THEN
 RAISE EXCEPTION 'Unsupported commercial field'; END IF;
 IF NOT (p_patch ?| ARRAY['cost_before_vat','usage_rights_cost','cost_vat_percent','cost_vat_exempt']) THEN RAISE EXCEPTION 'Cost patch required'; END IF;
 -- Also protects reconciliation of an already-approved master whose projections are stale.
 IF (SELECT cost_locked FROM assignment_commercial_locks(ARRAY[p_line])) IS DISTINCT FROM false THEN RAISE EXCEPTION 'Set the recorded vendor payment to zero before changing costs.'; END IF;
 PERFORM id FROM campaign_influencers WHERE campaign_line_id=p_line ORDER BY id FOR UPDATE;
 IF (SELECT cost_locked FROM assignment_commercial_locks(ARRAY[p_line])) IS DISTINCT FROM false THEN
 RAISE EXCEPTION 'Vendor payment is recorded. Set the payment to zero before changing costs.'; END IF;
 patch:=p_patch;
 IF patch ? 'cost_before_vat' THEN patch:=patch || jsonb_build_object('cost',patch->'cost_before_vat'); END IF;
 IF coalesce(prior.cost_received_currency,prior.currency_code)=coalesce(patch->>'currency_code',prior.currency_code) THEN cross_rate:=1;
 ELSE cross_rate:=coalesce(nullif(prior.fx_cost_revenue_cross_rate,0),nullif(prior.cost_before_vat,0)/nullif(prior.cost_received,0),nullif(prior.fx_rate,0)); END IF;
 IF cross_rate IS NULL OR cross_rate<=0 THEN RAISE EXCEPTION 'A valid vendor currency conversion is required.'; END IF;
 native_cost:=round(coalesce((patch->>'cost_before_vat')::numeric,prior.cost_before_vat)/cross_rate,2);
 patch:=patch || jsonb_build_object('cost_received',native_cost);
 SELECT string_agg(format('%I=(jsonb_populate_record(NULL::public.campaign_lines,$1)).%I',key,key),',') INTO assignments FROM jsonb_object_keys(patch) key;
 EXECUTE format('UPDATE public.campaign_lines SET %s WHERE id=$2',assignments) USING patch,p_line;
 SELECT * INTO STRICT updated FROM campaign_lines WHERE id=p_line;
 rate:=CASE WHEN updated.cost_vat_exempt THEN 0 ELSE coalesce(updated.cost_vat_percent,0) END;
 FOR assignment_row IN SELECT id FROM campaign_influencers WHERE campaign_line_id=p_line ORDER BY id FOR UPDATE LOOP
   UPDATE campaign_influencers SET agreed_fee=native_cost,cost_before_vat=native_cost,cost_vat_percent=rate,
     cost_vat_amount=round(native_cost*rate/100,2),cost_after_vat=native_cost+round(native_cost*rate/100,2) WHERE id=assignment_row.id;
   UPDATE creator_payment_terms SET fee=(SELECT cost_before_vat FROM campaign_influencers WHERE id=assignment_row.id),vat=rate,updated_at=now(),updated_by=auth.uid() WHERE assignment_id=assignment_row.id;
 END LOOP;
 -- Preserve IDs, uploads, publication dates, revenue, invoice links and allocation weights.
 WITH weights AS (
 SELECT id,quantity,CASE WHEN updated.pricing_mode='package' OR sum(cost_before_vat) OVER()<=0 THEN greatest(quantity,1) ELSE cost_before_vat END w
 FROM assignment_deliverables WHERE campaign_line_id=p_line
 ), shares AS (SELECT *,sum(w) OVER(ORDER BY id) running,sum(w) OVER() total FROM weights), amounts AS (
 SELECT id,quantity,round(updated.cost_before_vat*running/total,2)-round(updated.cost_before_vat*(running-w)/total,2) cost,
 round(coalesce(updated.usage_rights_cost,0)*running/total,2)-round(coalesce(updated.usage_rights_cost,0)*(running-w)/total,2) ur FROM shares
 ) UPDATE assignment_deliverables d SET cost_before_vat=x.cost,total_cost=x.cost,unit_cost=round(x.cost/greatest(x.quantity,1),2),usage_rights_cost=x.ur,
 cost_vat_percent=rate,cost_vat_exempt=updated.cost_vat_exempt,cost_vat_amount=round(x.cost*rate/100,2),cost_after_vat=x.cost+round(x.cost*rate/100,2)
 FROM amounts x WHERE d.id=x.id;
 WITH weights AS (
 SELECT p.id,d.id deliverable_id,d.cost_before_vat cost,CASE WHEN sum(p.cost_before_vat) OVER(PARTITION BY d.id)>0 THEN p.cost_before_vat ELSE 1 END w
 FROM assignment_post_schedule p JOIN assignment_deliverables d ON d.id=p.assignment_deliverable_id WHERE p.campaign_line_id=p_line
 ), shares AS (SELECT *,sum(w) OVER(PARTITION BY deliverable_id ORDER BY id) running,sum(w) OVER(PARTITION BY deliverable_id) total FROM weights), amounts AS (
 SELECT id,round(cost*running/total,2)-round(cost*(running-w)/total,2) cost FROM shares
 ) UPDATE assignment_post_schedule p SET cost_before_vat=x.cost,cost_vat_percent=rate,cost_vat_amount=round(x.cost*rate/100,2) FROM amounts x WHERE p.id=x.id;
 -- The editable per-deliverable metadata is another projection of the same master.
 IF jsonb_typeof(updated.metadata#>'{influencer_assignment,commercial_rows}')='array' AND jsonb_array_length(updated.metadata#>'{influencer_assignment,commercial_rows}')>0 THEN
 WITH weights AS (
 SELECT value,ordinality,CASE WHEN sum(coalesce((value->>'cost_before_vat')::numeric,0)) OVER()>0 THEN coalesce((value->>'cost_before_vat')::numeric,0) ELSE greatest(coalesce((value->>'quantity')::numeric,1),1) END w
 FROM jsonb_array_elements(updated.metadata#>'{influencer_assignment,commercial_rows}') WITH ORDINALITY
 ), shares AS (SELECT *,sum(w) OVER(ORDER BY ordinality) running,sum(w) OVER() total FROM weights), amounts AS (
 SELECT *,round(updated.cost_before_vat*running/total,2)-round(updated.cost_before_vat*(running-w)/total,2) cost,
 round(coalesce(updated.usage_rights_cost,0)*running/total,2)-round(coalesce(updated.usage_rights_cost,0)*(running-w)/total,2) ur FROM shares)
 SELECT jsonb_agg(value || jsonb_build_object('cost_before_vat',cost,'total_cost',cost,'unit_cost',round(cost/greatest(coalesce((value->>'quantity')::numeric,1),1),2),'usage_rights_cost',ur) ORDER BY ordinality) INTO rows_json FROM amounts;
 UPDATE campaign_lines SET metadata=jsonb_set(metadata,'{influencer_assignment,commercial_rows}',rows_json) WHERE id=p_line;
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;