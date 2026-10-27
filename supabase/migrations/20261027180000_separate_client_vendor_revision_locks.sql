BEGIN;
-- Client invoices lock client tax, not unpaid vendor costs.
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
  IF v_cost_changed AND NOT v_override_active THEN
    IF OLD.cost_locked THEN
      RAISE EXCEPTION 'Cost is locked on line %. Ungenerate the Vendor IO before editing costs.', OLD.document_number
        USING ERRCODE = 'check_violation';
    END IF;
    -- Payment writers lock these same assignment rows; do not race a payment.
    PERFORM id FROM public.campaign_influencers WHERE campaign_line_id=OLD.id ORDER BY id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.campaign_influencers a WHERE a.campaign_line_id=OLD.id AND
      (a.vendor_payment_status='paid' OR EXISTS(SELECT 1 FROM public.creator_payment_entries e
       WHERE e.assignment_id=a.id AND e.status IN ('paid','exported') AND e.cleared_at IS NULL))) THEN
      RAISE EXCEPTION 'Vendor payment is recorded or pending. Clear the payment before changing costs.'
        USING ERRCODE = 'check_violation';
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
 IF (OLD.cost_locked OR OLD.vendor_assignment_locked) AND NOT coalesce(NEW.finance_override_until>now(),false) THEN
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
COMMIT;
