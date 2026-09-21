ALTER TABLE public.creator_payment_entries ALTER COLUMN batch_id DROP NOT NULL;
ALTER TABLE public.creator_payment_entries ADD COLUMN source text NOT NULL DEFAULT 'bank_export' CHECK(source IN ('bank_export','manual'));
ALTER TABLE public.creator_payment_entries ADD COLUMN payment_date date;
ALTER TABLE public.creator_payment_entries ADD COLUMN payment_sequence integer;
UPDATE public.creator_payment_entries e SET payment_date=b.transfer_date FROM public.creator_payment_exports b WHERE e.batch_id=b.id;
WITH numbered AS (
 SELECT id,row_number() OVER(PARTITION BY assignment_id ORDER BY coalesce(confirmed_at,created_at),id) AS n
 FROM public.creator_payment_entries WHERE status='paid'
) UPDATE public.creator_payment_entries e SET payment_sequence=n.n FROM numbered n WHERE n.id=e.id;
CREATE UNIQUE INDEX creator_payment_sequence_unique ON public.creator_payment_entries(assignment_id,payment_sequence) WHERE payment_sequence IS NOT NULL;

CREATE OR REPLACE FUNCTION public.number_creator_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.payment_date IS NULL AND NEW.batch_id IS NOT NULL THEN
   SELECT transfer_date INTO NEW.payment_date FROM creator_payment_exports WHERE id=NEW.batch_id;
 END IF;
 IF NEW.status='paid' AND NEW.payment_sequence IS NULL THEN
   PERFORM id FROM campaign_influencers WHERE id=NEW.assignment_id FOR UPDATE;
   SELECT coalesce(max(payment_sequence),0)+1 INTO NEW.payment_sequence FROM creator_payment_entries WHERE assignment_id=NEW.assignment_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.number_creator_payment() FROM PUBLIC;
CREATE TRIGGER number_creator_payment BEFORE INSERT OR UPDATE OF status ON public.creator_payment_entries FOR EACH ROW EXECUTE FUNCTION public.number_creator_payment();

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
   SELECT * INTO v FROM vendor_ios WHERE assignment_id=a.id AND document_generated_at IS NOT NULL ORDER BY created_at DESC,id DESC LIMIT 1;
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
REVOKE ALL ON FUNCTION public.record_creator_payments(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_creator_payments(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
