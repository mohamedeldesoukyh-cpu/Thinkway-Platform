ALTER TABLE public.creator_payment_entries ADD COLUMN revision integer NOT NULL DEFAULT 0;
ALTER TABLE public.creator_payment_entries ADD COLUMN cleared_at timestamptz;
CREATE TABLE public.creator_payment_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entry_id uuid NOT NULL REFERENCES public.creator_payment_entries(id),
 campaign_id uuid NOT NULL REFERENCES public.campaign_headers(id), previous_values jsonb NOT NULL,
 reason text NOT NULL, changed_by uuid NOT NULL REFERENCES auth.users(id), changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_payment_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_revision_read ON public.creator_payment_revisions FOR SELECT TO authenticated USING(public.can_manage_creator_payments(campaign_id,false));
GRANT SELECT ON public.creator_payment_revisions TO authenticated;

CREATE FUNCTION public.revise_creator_payment(p_entry uuid,p_revision integer,p_amount numeric,p_date date,p_clear boolean,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE e record; a record; assignment uuid; paid numeric; reserved numeric; total numeric; original numeric;
BEGIN
 SELECT assignment_id INTO assignment FROM creator_payment_entries WHERE id=p_entry;
 SELECT * INTO a FROM campaign_influencers WHERE id=assignment FOR UPDATE;
 IF auth.uid() IS NULL OR a.id IS NULL OR NOT public.can_manage_creator_payments(a.campaign_header_id,true) THEN RAISE EXCEPTION 'Finance access required'; END IF;
 SELECT * INTO e FROM creator_payment_entries WHERE id=p_entry FOR UPDATE;
 IF e.revision IS DISTINCT FROM p_revision OR e.status<>'paid' OR e.cleared_at IS NOT NULL THEN RAISE EXCEPTION 'Payment changed. Refresh before revising it'; END IF;
 IF p_clear IS NULL OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 1 AND 250 THEN RAISE EXCEPTION 'Enter a correction reason'; END IF;
 IF NOT p_clear AND (coalesce(p_amount,0) NOT BETWEEN 0.01 AND 9999999999999 OR p_date IS NULL OR p_date>(now() AT TIME ZONE 'Africa/Cairo')::date) THEN RAISE EXCEPTION 'Enter a positive amount and actual payment date'; END IF;
 original:=CASE WHEN p_clear THEN 0 ELSE round(round(p_amount,2)/e.exchange_rate,2) END;
 IF NOT p_clear AND original<=0 THEN RAISE EXCEPTION 'Payment is below original currency precision'; END IF;
 SELECT coalesce(sum(original_amount) FILTER(WHERE status='paid'),0),coalesce(sum(original_amount) FILTER(WHERE status='exported'),0) INTO paid,reserved FROM creator_payment_entries WHERE assignment_id=a.id AND id<>p_entry;
 SELECT round(coalesce(a.cost_before_vat,a.agreed_fee,e.original_fee),2)*(1+coalesce(t.vat,a.cost_vat_percent,0)/100) INTO total FROM (SELECT 1) x LEFT JOIN creator_payment_terms t ON t.assignment_id=a.id;
 total:=round(total,2);
 IF original+paid+reserved>total THEN RAISE EXCEPTION 'Revised payment exceeds available balance'; END IF;
 INSERT INTO creator_payment_revisions(entry_id,campaign_id,previous_values,reason,changed_by) VALUES(e.id,e.campaign_id,to_jsonb(e),trim(p_reason),auth.uid());
 UPDATE creator_payment_entries SET payment_amount=CASE WHEN p_clear THEN payment_amount ELSE round(p_amount,2) END,
 original_amount=CASE WHEN p_clear THEN original_amount ELSE original END,payment_date=CASE WHEN p_clear THEN payment_date ELSE p_date END,
 status=CASE WHEN p_clear THEN 'failed' ELSE 'paid' END,cleared_at=CASE WHEN p_clear THEN now() ELSE NULL END,revision=revision+1 WHERE id=e.id;
 UPDATE campaign_influencers SET vendor_payment_status=(CASE WHEN paid+original>=total THEN 'paid' WHEN paid+original>0 THEN 'pending' ELSE 'unpaid' END)::public.vendor_payment_status,
 vendor_paid_at=CASE WHEN paid+original>=total THEN now() ELSE NULL END WHERE id=a.id;
END $$;
REVOKE ALL ON FUNCTION public.revise_creator_payment(uuid,integer,numeric,date,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revise_creator_payment(uuid,integer,numeric,date,boolean,text) TO authenticated;

CREATE FUNCTION public.record_creator_payment_series(p_rows jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb;
BEGIN
 IF auth.uid() IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Finance access required'; END IF;
 IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Enter 1 to 50 payments'; END IF;
 IF (SELECT count(DISTINCT value->>'requestId') FROM jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows) THEN RAISE EXCEPTION 'Duplicate payment request'; END IF;
 PERFORM id FROM campaign_influencers WHERE id IN(SELECT (value->>'assignmentId')::uuid FROM jsonb_array_elements(p_rows)) ORDER BY id FOR UPDATE;
 FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
   PERFORM public.record_creator_payments((item->>'requestId')::uuid,jsonb_build_array(item));
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.record_creator_payment_series(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_creator_payment_series(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
