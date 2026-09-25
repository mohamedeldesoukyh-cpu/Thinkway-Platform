BEGIN;
ALTER TABLE public.creator_supplier_invoices ADD COLUMN from_payment_register boolean NOT NULL DEFAULT false, ADD COLUMN revision integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX supplier_payment_register_unique ON public.creator_supplier_invoices(assignment_id) WHERE from_payment_register;
CREATE TRIGGER audit_supplier_invoice_updates AFTER UPDATE ON public.creator_supplier_invoices FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE FUNCTION public.save_creator_payment_invoice(p_assignment uuid,p_number text,p_date date,p_country text,p_vat boolean,p_revision integer,p_expected_vat numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.campaign_influencers; l public.campaign_lines; prior public.creator_supplier_invoices; creator public.influencers;
 rate numeric:=CASE WHEN p_vat THEN 14 ELSE 0 END; invoice_no text:=nullif(trim(p_number),'');
BEGIN
 SELECT * INTO a FROM campaign_influencers WHERE id=p_assignment;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT can_manage_creator_payments(a.campaign_header_id,true) THEN RAISE EXCEPTION 'Finance access required'; END IF;
 IF p_vat IS NULL OR p_revision IS NULL OR p_expected_vat IS NULL OR p_country IS NULL OR p_country !~ '^[A-Z]{2}$' OR length(coalesce(invoice_no,''))>100 THEN RAISE EXCEPTION 'Enter valid invoice and tax country details'; END IF;
 IF invoice_no IS NOT NULL AND (p_date IS NULL OR p_date>CURRENT_DATE) THEN RAISE EXCEPTION 'Enter the original invoice date, today or earlier'; END IF;
 -- Match the existing assignment VAT trigger lock order.
 SELECT * INTO l FROM campaign_lines WHERE id=a.campaign_line_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment cost line missing'; END IF;
 SELECT * INTO a FROM campaign_influencers WHERE id=p_assignment FOR UPDATE;
 SELECT * INTO prior FROM creator_supplier_invoices WHERE assignment_id=a.id AND from_payment_register FOR UPDATE;
 IF coalesce(prior.revision,0)<>p_revision OR a.cost_vat_percent IS DISTINCT FROM p_expected_vat THEN RAISE EXCEPTION 'Invoice or VAT changed. Refresh payments before saving'; END IF;
 IF rate IS DISTINCT FROM a.cost_vat_percent THEN
   IF a.vendor_payment_status='paid' AND NOT EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=a.id) THEN RAISE EXCEPTION 'This legacy payment has no payment history. Record its original payment details before changing VAT'; END IF;
   UPDATE campaign_lines SET cost_vat_percent=rate,cost_vat_exempt=NOT p_vat WHERE id=l.id;
   -- Existing triggers enforce cost locks, pending bank exports and paid balance guards.
 END IF;
 SELECT * INTO creator FROM influencers WHERE id=a.influencer_id;
 INSERT INTO creator_supplier_invoices(request_id,assignment_id,status,invoice_number,invoice_date,country_code,currency,supplier_name,subtotal,vat_amount,confirmed,recorded_by,from_payment_register,revision)
 VALUES(gen_random_uuid(),a.id,CASE WHEN invoice_no IS NULL THEN 'not_received' ELSE 'received' END,invoice_no,CASE WHEN invoice_no IS NULL THEN NULL ELSE p_date END,p_country,a.currency,coalesce(creator.legal_name,creator.display_name,'Creator'),l.cost_before_vat,round(l.cost_before_vat*rate/100,2),invoice_no IS NOT NULL,auth.uid(),true,1)
 ON CONFLICT(assignment_id) WHERE from_payment_register DO UPDATE SET
 status=excluded.status,invoice_number=excluded.invoice_number,invoice_date=excluded.invoice_date,country_code=excluded.country_code,currency=excluded.currency,subtotal=excluded.subtotal,vat_amount=excluded.vat_amount,confirmed=excluded.confirmed,revision=creator_supplier_invoices.revision+1;
 -- A duplicate invoice registered separately aborts the entire transaction; never double count it.
END $$;
REVOKE ALL ON FUNCTION public.save_creator_payment_invoice(uuid,text,date,text,boolean,integer,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_creator_payment_invoice(uuid,text,date,text,boolean,integer,numeric) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
