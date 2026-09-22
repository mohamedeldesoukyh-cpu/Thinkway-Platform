BEGIN;
-- Assignment VAT is the source for vendor costs and current payment balances.
-- Historical payments and exported bank files are never rewritten.
CREATE FUNCTION public.sync_assignment_cost_vat() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a record; paid numeric; reserved numeric; effective_rate numeric; total numeric;
BEGIN
 IF (NEW.cost_vat_percent,NEW.cost_vat_exempt) IS NOT DISTINCT FROM (OLD.cost_vat_percent,OLD.cost_vat_exempt) THEN RETURN NEW; END IF;
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
CREATE TRIGGER sync_assignment_cost_vat AFTER UPDATE OF cost_vat_percent,cost_vat_exempt ON public.campaign_lines FOR EACH ROW EXECUTE FUNCTION public.sync_assignment_cost_vat();
CREATE OR REPLACE FUNCTION public.compute_campaign_line_financials()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_billable_base numeric;
BEGIN
  IF NEW.fx_rate IS NULL OR NEW.fx_rate <= 0 THEN
    NEW.fx_rate := 1;
  END IF;

  NEW.revenue_before_vat := ROUND(COALESCE(NEW.revenue_before_vat, NEW.revenue, 0), 2);
  NEW.cost_before_vat := ROUND(COALESCE(NEW.cost_before_vat, NEW.cost, 0), 2);

  IF COALESCE(NEW.revenue_vat_exempt, false) THEN
    IF NOT NEW.vat_locked THEN
      NEW.revenue_vat_percent := 0;
    END IF;
    NEW.revenue_vat_amount := 0;
  ELSE
    NEW.revenue_vat_amount := ROUND(
      NEW.revenue_before_vat * COALESCE(NEW.revenue_vat_percent, 0) / 100,
      2
    );
  END IF;

  NEW.revenue_after_vat := ROUND(NEW.revenue_before_vat + NEW.revenue_vat_amount, 2);

  IF COALESCE(NEW.cost_vat_exempt, false) THEN
    IF NOT NEW.vat_locked THEN
      NEW.cost_vat_percent := 0;
    END IF;
    NEW.cost_vat_amount := 0;
  ELSE
    NEW.cost_vat_amount := ROUND(
      NEW.cost_before_vat * COALESCE(NEW.cost_vat_percent, 0) / 100,
      2
    );
  END IF;

  NEW.cost_after_vat := ROUND(NEW.cost_before_vat + NEW.cost_vat_amount, 2);

  NEW.revenue := NEW.revenue_before_vat;
  NEW.cost := NEW.cost_before_vat;
  NEW.profit := ROUND(NEW.revenue - NEW.cost, 2);

  IF COALESCE(NEW.revenue, 0) > 0 THEN
    NEW.profit_margin := ROUND((NEW.profit / NEW.revenue) * 100, 4);
  ELSE
    NEW.profit_margin := 0;
  END IF;

  IF COALESCE(NEW.cost, 0) > 0 THEN
    NEW.markup_margin := ROUND((NEW.profit / NEW.cost) * 100, 4);
  ELSE
    NEW.markup_margin := 0;
  END IF;

  v_billable_base := public.resolve_line_po_billable_base(
    NEW.revenue_before_vat,
    NEW.revenue,
    NEW.usage_rights_amount,
    NEW.agency_fee_amount,
    NEW.agency_fee_percent
  );

  NEW.remaining_po := ROUND(COALESCE(NEW.po_amount, 0) - v_billable_base, 2);
  NEW.revenue_base := ROUND(NEW.revenue / NEW.fx_rate, 2);
  NEW.cost_base := ROUND(NEW.cost / NEW.fx_rate, 2);
  NEW.profit_base := ROUND(NEW.revenue_base - NEW.cost_base, 2);

  RETURN NEW;
END;
$function$

;
-- Prevent stale payment drafts from changing assignment VAT independently.
CREATE OR REPLACE FUNCTION public.enforce_creator_payment_cost_vat() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $cost_vat$
DECLARE expected numeric;
BEGIN
 SELECT CASE WHEN l.cost_vat_exempt THEN 0 ELSE coalesce(l.cost_vat_percent,0) END INTO expected
 FROM campaign_influencers a JOIN campaign_lines l ON l.id=a.campaign_line_id WHERE a.id=NEW.assignment_id;
 IF FOUND AND NEW.vat IS DISTINCT FROM expected THEN
   RAISE EXCEPTION 'Cost VAT changed. Refresh payments; edit cost VAT in Assignments.';
 END IF;
 RETURN NEW;
END $cost_vat$;
REVOKE ALL ON FUNCTION public.enforce_creator_payment_cost_vat() FROM PUBLIC;
CREATE TRIGGER enforce_creator_payment_cost_vat BEFORE INSERT OR UPDATE OF vat ON public.creator_payment_terms FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_payment_cost_vat();
COMMIT;
