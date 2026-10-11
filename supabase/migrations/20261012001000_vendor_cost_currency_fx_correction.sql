BEGIN;
CREATE OR REPLACE FUNCTION public.enforce_campaign_line_billing_lock()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_override_active boolean; v_vendor_correction boolean;
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

  IF OLD.cost_locked AND NEW.cost IS DISTINCT FROM OLD.cost AND NOT v_override_active THEN
    RAISE EXCEPTION 'Cost is locked on line %. Finance override required.', OLD.document_number
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.vat_locked AND NOT v_override_active THEN
    IF NEW.revenue_vat_percent IS DISTINCT FROM OLD.revenue_vat_percent
      OR NEW.revenue_vat_exempt IS DISTINCT FROM OLD.revenue_vat_exempt
      OR NEW.revenue_before_vat IS DISTINCT FROM OLD.revenue_before_vat
      OR (NEW.cost_vat_percent IS DISTINCT FROM OLD.cost_vat_percent AND NOT v_vendor_correction)
      OR (NEW.cost_vat_exempt IS DISTINCT FROM OLD.cost_vat_exempt AND NOT v_vendor_correction)
      OR (NEW.cost_before_vat IS DISTINCT FROM OLD.cost_before_vat AND NOT v_vendor_correction) THEN
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
 UPDATE campaign_lines SET vendor_io_id=next_id,metadata=metadata-'pending_vendor_io_id',operational_status='io_generated',billing_status=CASE WHEN invoice_id IS NULL THEN 'moved_to_billing' ELSE billing_status END WHERE id=ANY(ids);
 UPDATE vendor_ios SET lifecycle_reason_code='superseded',updated_by=auth.uid() WHERE id=p_io;
 INSERT INTO business_change_events(event_type,reason_code,reason_detail,campaign_header_id,entity_type,entity_id,payload,actor_id)
 VALUES('vendor_io_regenerated','vendor_io_regenerated',v.lifecycle_reason_detail,v.campaign_header_id,'vendor_io',next_id,jsonb_build_object('previous_io_id',p_io,'amount',total,'currency',c),auth.uid());
 RETURN next_id;
END; $$;
REVOKE ALL ON FUNCTION public.regenerate_reopened_vendor_io(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_reopened_vendor_io(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.update_reopened_vendor_cost(p_line uuid,p_cost numeric,p_usage_cost numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l campaign_lines%ROWTYPE; old_io uuid; a record; rate numeric; fee_amount numeric;
BEGIN
 SELECT (metadata->>'pending_vendor_io_id')::uuid INTO old_io FROM campaign_lines WHERE id=p_line;
 IF old_io IS NULL THEN RAISE EXCEPTION 'Ungenerate the Vendor IO before editing its cost.'; END IF;
 PERFORM assert_vendor_io_reopenable(old_io);
 SELECT * INTO STRICT l FROM campaign_lines WHERE id=p_line FOR UPDATE;
 IF l.metadata->>'pending_vendor_io_id' IS DISTINCT FROM old_io::text OR l.vendor_io_id IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM vendor_ios WHERE id=old_io AND is_superseded AND lifecycle_reason_code='pending_regeneration') THEN
  RAISE EXCEPTION 'Vendor IO state changed. Refresh before editing.';
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
REVOKE ALL ON FUNCTION public.update_reopened_vendor_cost(uuid,numeric,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_reopened_vendor_cost(uuid,numeric,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_reopened_vendor_cost_side(
 p_campaign uuid,p_line uuid,p_currency text,p_cost numeric,p_usage_cost numeric,p_vat numeric,p_fx text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l campaign_lines%ROWTYPE; old_io uuid; cost_rate numeric; rev_rate numeric; cross_rate numeric; a record;
BEGIN
 SELECT (metadata->>'pending_vendor_io_id')::uuid INTO old_io FROM campaign_lines WHERE id=p_line AND campaign_header_id=p_campaign;
 IF old_io IS NULL THEN RAISE EXCEPTION 'Ungenerate the Vendor IO before editing its cost side.'; END IF;
 PERFORM assert_vendor_io_reopenable(old_io);
 SELECT * INTO STRICT l FROM campaign_lines WHERE id=p_line AND campaign_header_id=p_campaign FOR UPDATE;
 IF l.vendor_io_id IS NOT NULL OR l.metadata->>'pending_vendor_io_id' IS DISTINCT FROM old_io::text OR l.status='cancelled'
 OR NOT EXISTS(SELECT 1 FROM vendor_ios WHERE id=old_io AND is_superseded AND lifecycle_reason_code='pending_regeneration') THEN
  RAISE EXCEPTION 'Vendor IO state changed. Refresh before saving.';
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
REVOKE ALL ON FUNCTION public.update_reopened_vendor_cost_side(uuid,uuid,text,numeric,numeric,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_reopened_vendor_cost_side(uuid,uuid,text,numeric,numeric,numeric,text) TO authenticated;
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
 IF (OLD.cost_locked OR OLD.vat_locked OR OLD.vendor_assignment_locked) AND NOT coalesce(NEW.finance_override_until>now(),false) THEN
   RAISE EXCEPTION 'Cost VAT is locked. Finance override required';
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
REVOKE ALL ON FUNCTION public.sync_assignment_cost_vat() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.sync_campaign_influencer_cost_vat()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE l campaign_lines%ROWTYPE; native_cost numeric;
BEGIN
 IF NEW.campaign_line_id IS NOT NULL THEN
  SELECT * INTO l FROM campaign_lines WHERE id=NEW.campaign_line_id;
  IF l.metadata->>'vendor_native_cost'='true' THEN
   native_cost:=coalesce(l.cost_received,l.cost_before_vat);
   NEW.currency:=coalesce(l.cost_received_currency,l.currency_code);
   NEW.cost_before_vat:=native_cost;
   NEW.cost_vat_percent:=CASE WHEN l.cost_vat_exempt THEN 0 ELSE l.cost_vat_percent END;
   NEW.cost_vat_amount:=round(native_cost*NEW.cost_vat_percent/100,2);
   NEW.cost_after_vat:=native_cost+NEW.cost_vat_amount;
  ELSE
   NEW.cost_before_vat:=l.cost_before_vat; NEW.cost_vat_percent:=l.cost_vat_percent;
   NEW.cost_vat_amount:=l.cost_vat_amount; NEW.cost_after_vat:=l.cost_after_vat;
  END IF;
 END IF;
 NEW.agreed_fee:=coalesce(NEW.cost_before_vat,NEW.agreed_fee,0);
 RETURN NEW;
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
