-- Additive creator-payment ledger. Does not alter IO approval or campaign stages.
CREATE FUNCTION public.can_manage_creator_payments(p_campaign uuid, p_write boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT coalesce(auth.uid() IS NOT NULL AND public.is_internal_user()
    AND (public.is_admin() OR public.has_permission('finance.override') OR public.has_permission('finance.write') OR (NOT p_write AND public.has_permission('finance.read')))
    AND public.can_access_campaign_header(p_campaign),false);
$$;
REVOKE ALL ON FUNCTION public.can_manage_creator_payments(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_creator_payments(uuid,boolean) TO authenticated;
CREATE TABLE public.creator_payment_terms (
  assignment_id uuid PRIMARY KEY REFERENCES public.campaign_influencers(id),
  campaign_id uuid NOT NULL REFERENCES public.campaign_headers(id),
  fee numeric(18,2) NOT NULL CHECK(fee >= 0),
  vat numeric(7,4) NOT NULL CHECK(vat BETWEEN 0 AND 100),
  updated_by uuid NOT NULL REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.creator_payment_exports (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaign_headers(id),
  transfer_date date NOT NULL,
  csv_content text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.creator_payment_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.creator_payment_exports(id),
  campaign_id uuid NOT NULL REFERENCES public.campaign_headers(id),
  assignment_id uuid NOT NULL REFERENCES public.campaign_influencers(id),
  io_id uuid NOT NULL REFERENCES public.vendor_ios(id),
  creator_name text NOT NULL,
  original_currency text NOT NULL,
  original_amount numeric(18,2) NOT NULL CHECK(original_amount > 0),
  original_total numeric(18,2) NOT NULL CHECK(original_total > 0),
  original_fee numeric(18,2) NOT NULL,
  vat_percent numeric(7,4) NOT NULL,
  payment_currency text NOT NULL,
  exchange_rate numeric(20,8) NOT NULL CHECK(exchange_rate > 0),
  payment_amount numeric(18,2) NOT NULL CHECK(payment_amount > 0),
  status text NOT NULL DEFAULT 'exported' CHECK(status IN ('exported','paid','failed')),
  bank_reference text,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id, assignment_id)
);
CREATE INDEX creator_payment_entries_assignment ON public.creator_payment_entries(assignment_id);
ALTER TABLE public.creator_payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payment_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payment_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY creator_payment_terms_read ON public.creator_payment_terms FOR SELECT TO authenticated USING(public.can_manage_creator_payments(campaign_id,false));
CREATE POLICY creator_payment_exports_read ON public.creator_payment_exports FOR SELECT TO authenticated USING(public.can_manage_creator_payments(campaign_id,false));
CREATE POLICY creator_payment_entries_read ON public.creator_payment_entries FOR SELECT TO authenticated USING(public.can_manage_creator_payments(campaign_id,false));
GRANT SELECT ON public.creator_payment_terms,public.creator_payment_exports,public.creator_payment_entries TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.creator_payment_terms,public.creator_payment_exports,public.creator_payment_entries FROM authenticated;

CREATE FUNCTION public.create_creator_payment_export(p_id uuid,p_campaign uuid,p_date date,p_csv text,p_rows jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb; a record; v record; paid numeric; reserved numeric; total numeric; original numeric; rate numeric; amount numeric; details jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_creator_payments(p_campaign,true) THEN RAISE EXCEPTION 'Finance access required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  IF EXISTS(SELECT 1 FROM creator_payment_exports WHERE id=p_id AND campaign_id=p_campaign) THEN RETURN p_id; END IF;
  IF p_date < (now() AT TIME ZONE 'Africa/Cairo')::date OR p_date > (now() AT TIME ZONE 'Africa/Cairo')::date + 14 THEN RAISE EXCEPTION 'Transfer date must be today or within 14 days'; END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Select 1 to 200 creators'; END IF;
  -- Stable lock order serializes exports and confirmations for each assignment.
  PERFORM id FROM campaign_influencers WHERE id IN (SELECT (value->>'assignmentId')::uuid FROM jsonb_array_elements(p_rows)) ORDER BY id FOR UPDATE;
  INSERT INTO creator_payment_exports(id,campaign_id,transfer_date,csv_content,created_by) VALUES(p_id,p_campaign,p_date,p_csv,auth.uid());
  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    SELECT * INTO a FROM campaign_influencers WHERE id=(r->>'assignmentId')::uuid AND campaign_header_id=p_campaign;
    IF a.id IS NULL THEN RAISE EXCEPTION 'Assignment outside campaign'; END IF;
    SELECT * INTO v FROM vendor_ios WHERE id=(r->>'ioId')::uuid AND assignment_id=a.id AND campaign_header_id=p_campaign AND NOT coalesce(is_superseded,false);
    IF v.id IS NULL OR v.document_generated_at IS NULL OR v.status::text IN ('cancelled','void','voided','rejected') THEN RAISE EXCEPTION 'A current generated IO is required'; END IF;
    SELECT payment_details INTO details FROM influencers WHERE id=a.influencer_id FOR SHARE;
    IF coalesce(details->>'aaib_registered','false') <> 'true' OR coalesce(details->>'aaib_nickname','')='' THEN RAISE EXCEPTION 'Confirm AAIB beneficiary registration first'; END IF;
    IF r->>'nickname' IS DISTINCT FROM details->>'aaib_nickname' THEN RAISE EXCEPTION 'Bank details changed; refresh before exporting'; END IF;
    IF r->>'currency' IS DISTINCT FROM details->>'aaib_currency' THEN RAISE EXCEPTION 'Payment currency must match the registered beneficiary currency'; END IF;
    IF (r->>'fee') IS NULL OR (r->>'vat') IS NULL OR (r->>'fee')::numeric NOT BETWEEN 0 AND 9999999999999 OR (r->>'vat')::numeric NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid fee or VAT'; END IF;
    total := round((r->>'fee')::numeric,2) + round(round((r->>'fee')::numeric,2)*(r->>'vat')::numeric/100,2);
    rate := CASE WHEN r->>'currency'=a.currency THEN 1 ELSE (r->>'rate')::numeric END;
    amount := round((r->>'amount')::numeric,2);
    IF rate IS NULL OR rate NOT BETWEEN 0.00000001 AND 999999999 OR amount IS NULL OR amount NOT BETWEEN 0.01 AND 9999999999999 THEN RAISE EXCEPTION 'Invalid payment or FX rate'; END IF;
    original := round(amount/rate,2);
    SELECT coalesce(sum(original_amount) FILTER(WHERE status='paid'),0), coalesce(sum(original_amount) FILTER(WHERE status='exported'),0) INTO paid,reserved FROM creator_payment_entries WHERE assignment_id=a.id;
    IF a.vendor_payment_status='paid' AND paid=0 THEN RAISE EXCEPTION 'Assignment was already paid through the existing payment workflow'; END IF;
    IF EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=a.id AND status IN ('paid','exported') AND original_currency<>a.currency) THEN RAISE EXCEPTION 'Assignment currency changed; reconcile existing payments before exporting'; END IF;
    IF reserved>0 AND EXISTS(SELECT 1 FROM creator_payment_terms WHERE assignment_id=a.id AND (fee IS DISTINCT FROM round((r->>'fee')::numeric,2) OR vat IS DISTINCT FROM (r->>'vat')::numeric)) THEN RAISE EXCEPTION 'Confirm pending bank results before changing fees or VAT'; END IF;
    IF original<=0 OR original+paid+reserved>total THEN RAISE EXCEPTION 'Payment exceeds outstanding balance or overlaps a pending export'; END IF;
    INSERT INTO creator_payment_terms(assignment_id,campaign_id,fee,vat,updated_by) VALUES(a.id,p_campaign,(r->>'fee')::numeric,(r->>'vat')::numeric,auth.uid()) ON CONFLICT(assignment_id) DO UPDATE SET fee=excluded.fee,vat=excluded.vat,updated_by=auth.uid(),updated_at=now();
    INSERT INTO creator_payment_entries(batch_id,campaign_id,assignment_id,io_id,creator_name,original_currency,original_amount,original_total,original_fee,vat_percent,payment_currency,exchange_rate,payment_amount)
    VALUES(p_id,p_campaign,a.id,v.id,r->>'creator',a.currency,original,total,round((r->>'fee')::numeric,2),(r->>'vat')::numeric,r->>'currency',rate,amount);
  END LOOP;
  RETURN p_id;
END $$;

CREATE FUNCTION public.confirm_creator_payment(p_entry uuid,p_status text,p_reference text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; paid numeric; total numeric;
BEGIN
  SELECT * INTO e FROM creator_payment_entries WHERE id=p_entry;
  IF e.id IS NULL OR auth.uid() IS NULL OR NOT public.can_manage_creator_payments(e.campaign_id,true) THEN RAISE EXCEPTION 'Finance access required'; END IF;
  PERFORM id FROM campaign_influencers WHERE id=e.assignment_id FOR UPDATE;
  SELECT * INTO e FROM creator_payment_entries WHERE id=p_entry FOR UPDATE;
  IF p_status NOT IN ('paid','failed') OR length(trim(coalesce(p_reference,'')))=0 THEN RAISE EXCEPTION 'Choose result and enter bank reference or rejection reason'; END IF;
  IF e.status=p_status THEN RETURN; END IF;
  IF e.status<>'exported' THEN RAISE EXCEPTION 'This result has already been confirmed'; END IF;
  UPDATE creator_payment_entries SET status=p_status,bank_reference=p_reference,confirmed_at=now(),confirmed_by=auth.uid() WHERE id=p_entry;
  SELECT coalesce(sum(original_amount),0) INTO paid FROM creator_payment_entries WHERE assignment_id=e.assignment_id AND status='paid';
  SELECT fee+round(fee*vat/100,2) INTO total FROM creator_payment_terms WHERE assignment_id=e.assignment_id;
  UPDATE campaign_influencers SET vendor_payment_status=(CASE WHEN paid>=total THEN 'paid' WHEN paid>0 THEN 'pending' ELSE 'unpaid' END)::public.vendor_payment_status, vendor_paid_at=CASE WHEN paid>=total THEN now() ELSE NULL END WHERE id=e.assignment_id;
END $$;
REVOKE ALL ON FUNCTION public.create_creator_payment_export(uuid,uuid,date,text,jsonb),public.confirm_creator_payment(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_creator_payment_export(uuid,uuid,date,text,jsonb),public.confirm_creator_payment(uuid,text,text) TO authenticated;

CREATE UNIQUE INDEX influencers_aaib_nickname_unique ON public.influencers(lower(trim(payment_details->>'aaib_nickname')))
WHERE nullif(trim(payment_details->>'aaib_nickname'),'') IS NOT NULL;

-- Covers edits through both the CRM AAIB editor and existing bank forms.
CREATE FUNCTION public.invalidate_aaib_registration() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE k text;
BEGIN
  IF nullif(OLD.payment_details->>'aaib_nickname','') IS NOT NULL THEN
    FOREACH k IN ARRAY ARRAY['beneficiary_name','account_number','iban','swift','bank_name','bank_branch','aaib_payment_type','aaib_currency','aaib_nickname','aaib_address','aaib_email','aaib_mobile','aaib_country','aaib_identifier','aaib_clearing_code','aaib_bank_address'] LOOP
      IF OLD.payment_details->>k IS DISTINCT FROM NEW.payment_details->>k THEN
        NEW.payment_details := jsonb_set(NEW.payment_details,'{aaib_registered}','false');
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invalidate_aaib_registration BEFORE UPDATE OF payment_details ON public.influencers FOR EACH ROW EXECUTE FUNCTION public.invalidate_aaib_registration();

CREATE FUNCTION public.guard_creator_payment_ledger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE paid numeric; total numeric;
BEGIN
  IF EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=OLD.id AND status IN ('paid','exported')) THEN
    IF NEW.payment_batch_id IS DISTINCT FROM OLD.payment_batch_id OR NEW.currency IS DISTINCT FROM OLD.currency THEN
      RAISE EXCEPTION 'Use Creator Payments to manage this assignment: it has a payment ledger';
    END IF;
    SELECT coalesce(sum(original_amount),0) INTO paid FROM creator_payment_entries WHERE assignment_id=OLD.id AND status='paid';
    SELECT fee+round(fee*vat/100,2) INTO total FROM creator_payment_terms WHERE assignment_id=OLD.id;
    IF NEW.vendor_payment_status IS DISTINCT FROM OLD.vendor_payment_status AND NEW.vendor_payment_status::text IS DISTINCT FROM (CASE WHEN paid>=total THEN 'paid' WHEN paid>0 THEN 'pending' ELSE 'unpaid' END) THEN
      RAISE EXCEPTION 'Confirm bank results in Creator Payments to update payment status';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_creator_payment_ledger BEFORE UPDATE OF payment_batch_id,currency,vendor_payment_status ON public.campaign_influencers FOR EACH ROW EXECUTE FUNCTION public.guard_creator_payment_ledger();

CREATE VIEW public.creator_payment_balances WITH (security_invoker=true) AS
SELECT t.assignment_id,t.campaign_id,t.fee,t.vat,t.fee+round(t.fee*t.vat/100,2) AS total,
 coalesce(sum(e.original_amount) FILTER(WHERE e.status='paid'),0) AS paid,
 coalesce(sum(e.original_amount) FILTER(WHERE e.status='exported'),0) AS reserved
FROM creator_payment_terms t LEFT JOIN creator_payment_entries e ON e.assignment_id=t.assignment_id
GROUP BY t.assignment_id,t.campaign_id,t.fee,t.vat;
GRANT SELECT ON public.creator_payment_balances TO authenticated;
