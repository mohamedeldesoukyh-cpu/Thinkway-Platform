-- Issuance survives document cache invalidation. No payment amounts or IO workflow states change.
BEGIN;
CREATE OR REPLACE FUNCTION public.vendor_io_has_issue_evidence(p_generated timestamptz, p_sent timestamptz, p_delivered timestamptz, p_approved timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce(p_generated,p_sent,p_delivered,p_approved) IS NOT NULL;
$$;


CREATE OR REPLACE FUNCTION public.create_creator_payment_export(p_id uuid,p_campaign uuid,p_date date,p_csv text,p_rows jsonb)
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
    IF v.id IS NULL OR NOT public.vendor_io_has_issue_evidence(v.document_generated_at,v.sent_at,v.delivered_at,v.approved_at) OR v.status::text IN ('cancelled','void','voided','rejected') THEN RAISE EXCEPTION 'A current generated IO is required'; END IF;
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

CREATE OR REPLACE FUNCTION public.enforce_creator_payment_agreed_fee()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE agreed numeric;
BEGIN
  SELECT coalesce(a.cost_before_vat, a.agreed_fee,
    (SELECT v.amount FROM vendor_ios v WHERE v.assignment_id=a.id
      AND public.vendor_io_has_issue_evidence(v.document_generated_at,v.sent_at,v.delivered_at,v.approved_at) ORDER BY v.created_at DESC LIMIT 1), 0)
  INTO agreed FROM campaign_influencers a WHERE a.id=NEW.assignment_id;
  IF agreed IS NULL OR NEW.fee IS DISTINCT FROM round(agreed, 2) THEN
    RAISE EXCEPTION 'Agreed creator fee is read-only. Refresh the campaign agreement.';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.save_creator_payment_plans(p_rows jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb; a record; d jsonb;
BEGIN
  IF auth.uid() IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Finance access required'; END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Save 1 to 200 payment plans'; END IF;
  PERFORM id FROM campaign_influencers WHERE id IN (SELECT (value->>'assignmentId')::uuid FROM jsonb_array_elements(p_rows)) ORDER BY id FOR UPDATE;
  FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    SELECT * INTO a FROM campaign_influencers WHERE id=(r->>'assignmentId')::uuid;
    IF a.id IS NULL OR NOT public.can_manage_creator_payments(a.campaign_header_id,true) THEN RAISE EXCEPTION 'Finance access required'; END IF;
    IF NOT EXISTS(SELECT 1 FROM vendor_ios WHERE assignment_id=a.id AND public.vendor_io_has_issue_evidence(document_generated_at,sent_at,delivered_at,approved_at) AND NOT coalesce(is_superseded,false) AND status::text NOT IN ('cancelled','void','voided','rejected')) THEN RAISE EXCEPTION 'A current generated IO is required'; END IF;
    d:=r->'draft';
    IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR length(d::text)>4000
       OR coalesce(d->>'mode','') NOT IN ('full','percent','manual')
       OR coalesce(d->>'currency','') !~ '^[A-Z]{3}$'
       OR coalesce((d->>'vat')::numeric,-1) NOT BETWEEN 0 AND 100
       OR coalesce((d->>'percent')::numeric,-1) NOT BETWEEN 0 AND 100
       OR coalesce((d->>'rate')::numeric,0) NOT BETWEEN 0.00000001 AND 999999999
       OR coalesce((d->>'amount')::numeric,-1) NOT BETWEEN 0 AND 9999999999999
       THEN RAISE EXCEPTION 'Invalid payment plan'; END IF;
    INSERT INTO creator_payment_plans(assignment_id,campaign_id,draft,updated_by)
      VALUES(a.id,a.campaign_header_id,d,auth.uid())
      ON CONFLICT(assignment_id) DO UPDATE SET draft=excluded.draft,updated_by=auth.uid(),updated_at=now();
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.record_creator_payments(p_request uuid,p_rows jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
<<payment_values>>
DECLARE r jsonb; a record; v record; existing record; entry_id uuid; total numeric; fee numeric; vat numeric; rate numeric; amount numeric; original numeric; paid numeric; reserved numeric; day date;
BEGIN
 IF auth.uid() IS NULL OR p_request IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Finance access required'; END IF;
 IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Enter 1 to 200 payments'; END IF;
 IF (SELECT count(DISTINCT value->>'assignmentId') FROM jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows) THEN RAISE EXCEPTION 'Duplicate payment rows'; END IF;
 PERFORM id FROM campaign_influencers WHERE id IN(SELECT (value->>'assignmentId')::uuid FROM jsonb_array_elements(p_rows)) ORDER BY id FOR UPDATE;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
   SELECT * INTO a FROM campaign_influencers WHERE id=(r->>'assignmentId')::uuid;
   IF a.id IS NULL OR NOT public.can_manage_creator_payments(a.campaign_header_id,true) THEN RAISE EXCEPTION 'Finance access required'; END IF;
   day:=(r->>'paymentDate')::date;
   IF day IS NULL OR day>(now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'Enter the actual payment date, no later than today'; END IF;
   amount:=round((r->>'amount')::numeric,2);
   rate:=CASE WHEN r->>'currency'=a.currency THEN 1 ELSE (r->>'rate')::numeric END;
   IF coalesce(r->>'currency','') !~ '^[A-Z]{3}$' OR coalesce(amount,0) NOT BETWEEN 0.01 AND 9999999999999 OR coalesce(rate,0) NOT BETWEEN 0.00000001 AND 999999999 THEN RAISE EXCEPTION 'Enter a positive payment amount and exchange rate'; END IF;
   original:=round(amount/rate,2);
   entry_id:=md5(p_request::text||a.id::text)::uuid;
   SELECT * INTO existing FROM creator_payment_entries WHERE id=entry_id;
   IF existing.id IS NOT NULL THEN
     IF existing.source<>'manual' OR existing.confirmed_by IS DISTINCT FROM auth.uid() OR existing.payment_amount IS DISTINCT FROM amount OR existing.payment_currency IS DISTINCT FROM r->>'currency' OR existing.exchange_rate IS DISTINCT FROM rate OR existing.payment_date IS DISTINCT FROM day OR existing.original_fee IS DISTINCT FROM (r->>'fee')::numeric OR existing.vat_percent IS DISTINCT FROM (r->>'vat')::numeric THEN RAISE EXCEPTION 'Payment request already used with different values'; END IF;
     CONTINUE;
   END IF;
   SELECT * INTO v FROM vendor_ios WHERE assignment_id=a.id AND public.vendor_io_has_issue_evidence(document_generated_at,sent_at,delivered_at,approved_at) ORDER BY created_at DESC,id DESC LIMIT 1;
   IF v.id IS NULL OR coalesce(v.is_superseded,false) OR v.status::text IN ('cancelled','void','voided','rejected') THEN RAISE EXCEPTION 'A current generated IO is required'; END IF;
   fee:=round(coalesce(a.cost_before_vat,a.agreed_fee,v.amount,0),2);
   vat:=(r->>'vat')::numeric;
   IF coalesce(vat,-1) NOT BETWEEN 0 AND 100 OR (r->>'fee')::numeric IS DISTINCT FROM fee THEN RAISE EXCEPTION 'Agreed fee changed or VAT is invalid. Refresh payments'; END IF;
   total:=fee+round(fee*vat/100,2);
   SELECT coalesce(sum(original_amount) FILTER(WHERE status='paid'),0),coalesce(sum(original_amount) FILTER(WHERE status='exported'),0) INTO paid,reserved FROM creator_payment_entries WHERE assignment_id=a.id;
   IF a.vendor_payment_status='paid' AND paid=0 THEN RAISE EXCEPTION 'This assignment was already paid through the existing workflow'; END IF;
   IF EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=a.id AND status IN ('paid','exported') AND original_currency<>a.currency) THEN RAISE EXCEPTION 'Original currency changed; reconcile previous payments'; END IF;
   IF reserved>0 AND EXISTS(SELECT 1 FROM creator_payment_terms WHERE assignment_id=a.id AND (creator_payment_terms.fee IS DISTINCT FROM payment_values.fee OR creator_payment_terms.vat IS DISTINCT FROM payment_values.vat)) THEN RAISE EXCEPTION 'Confirm pending bank results before changing VAT'; END IF;
   IF original<=0 OR original+paid+reserved>total THEN RAISE EXCEPTION 'Payment exceeds the remaining available balance. Confirm pending bank exports instead of recording them twice'; END IF;
   INSERT INTO creator_payment_terms(assignment_id,campaign_id,fee,vat,updated_by) VALUES(a.id,a.campaign_header_id,fee,vat,auth.uid())
     ON CONFLICT(assignment_id) DO UPDATE SET fee=excluded.fee,vat=excluded.vat,updated_by=auth.uid(),updated_at=now();
   INSERT INTO creator_payment_entries(id,batch_id,campaign_id,assignment_id,io_id,creator_name,original_currency,original_amount,original_total,original_fee,vat_percent,payment_currency,exchange_rate,payment_amount,status,source,payment_date,confirmed_at,confirmed_by)
     VALUES(entry_id,NULL,a.campaign_header_id,a.id,v.id,r->>'creator',a.currency,original,total,fee,vat,r->>'currency',rate,amount,'paid','manual',day,now(),auth.uid());
   paid:=paid+original;
   UPDATE campaign_influencers SET vendor_payment_status=(CASE WHEN paid>=total THEN 'paid' ELSE 'pending' END)::public.vendor_payment_status,vendor_paid_at=CASE WHEN paid>=total THEN now() ELSE NULL END WHERE id=a.id;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.invalidate_vendor_io_terms_documents()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF ROW(NEW.usage_rights, NEW.special_payment_terms, NEW.compliance_country_code,
         NEW.terms_text, NEW.exclusivity)
     IS DISTINCT FROM
     ROW(OLD.usage_rights, OLD.special_payment_terms, OLD.compliance_country_code,
         OLD.terms_text, OLD.exclusivity) THEN
    NEW.terms_html := NULL;
    NEW.generated_html_url := NULL;
    NEW.generated_pdf_url := NULL;
    -- Preserve last generation history; only the rendered assets are stale.
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
