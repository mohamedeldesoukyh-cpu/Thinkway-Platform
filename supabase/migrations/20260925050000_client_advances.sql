BEGIN;
ALTER TABLE public.payments ALTER COLUMN invoice_id DROP NOT NULL;
ALTER TABLE public.payments ADD COLUMN advance_campaign_id uuid REFERENCES public.campaign_headers(id) ON DELETE RESTRICT;
ALTER TABLE public.payments ADD COLUMN advance_source_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT;
ALTER TABLE public.payments ADD COLUMN receipt_request_id uuid UNIQUE;
CREATE INDEX payments_open_advances_idx ON public.payments(client_id,advance_campaign_id,currency) WHERE invoice_id IS NULL AND status='completed';

-- A split keeps cash unchanged: remaining advance + actual receipt = original receipt.
CREATE FUNCTION public.settle_collection_advance_internal(p_id uuid,p_invoice uuid,p_amount numeric,p_revision integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p payments%ROWTYPE; i invoices%ROWTYPE; result_id uuid; previous_guard text;
BEGIN
 SELECT * INTO i FROM invoices WHERE id=p_invoice FOR UPDATE;
 SELECT * INTO p FROM payments WHERE id=p_id FOR UPDATE;
 IF p.id IS NULL OR i.id IS NULL OR p.invoice_id IS NOT NULL OR p.status<>'completed' OR p_revision IS NULL OR p.revision<>p_revision THEN RAISE EXCEPTION 'Advance changed. Reload before settling'; END IF;
 IF i.client_id<>p.client_id OR i.currency<>p.currency OR (p.advance_campaign_id IS NOT NULL AND p.advance_campaign_id IS DISTINCT FROM i.campaign_header_id) THEN RAISE EXCEPTION 'Choose an invoice for the same client, currency and linked campaign'; END IF;
 IF i.issue_date IS NULL OR i.status='void' OR coalesce(i.regeneration_status,'active')<>'active' THEN RAISE EXCEPTION 'An issued active invoice is required'; END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_amount>p.amount OR p_amount>i.total-i.amount_paid THEN RAISE EXCEPTION 'Amount exceeds the advance or open invoice balance'; END IF;
 previous_guard:=current_setting('thinkway.applying_advance',true);
 PERFORM set_config('thinkway.applying_advance','yes',true);
 IF p_amount=p.amount THEN
   UPDATE payments SET invoice_id=i.id,revision=revision+1 WHERE id=p.id;
   result_id:=p.id;
 ELSE
   UPDATE payments SET amount=amount-p_amount,revision=revision+1 WHERE id=p.id;
   INSERT INTO payments(invoice_id,client_id,amount,currency,status,payment_method,reference_number,paid_at,notes,recorded_by,advance_campaign_id,advance_source_id,metadata)
   VALUES(i.id,p.client_id,p_amount,p.currency,'completed',p.payment_method,p.reference_number,p.paid_at,p.notes,p.recorded_by,p.advance_campaign_id,coalesce(p.advance_source_id,p.id),jsonb_build_object('advance_receipt',p.document_number)) RETURNING id INTO result_id;
 END IF;
 INSERT INTO payment_allocations(payment_id,invoice_id,allocated_amount,currency_code) VALUES(result_id,i.id,p_amount,p.currency);
 INSERT INTO collection_audit_logs(entity_type,entity_id,action,actor_id,metadata) VALUES('payment',p.id,'advance_settled',auth.uid(),jsonb_build_object('before',to_jsonb(p),'invoice_id',i.id,'actual_payment_id',result_id,'amount',p_amount));
 UPDATE assignment_deliverables d SET collected_amount=round(coalesce(l.revenue_before_vat,l.unit_price)*least(1,(SELECT amount_paid/nullif(total,0) FROM invoices WHERE id=i.id)),2),billing_status=(CASE WHEN (SELECT amount_paid>=total FROM invoices WHERE id=i.id) THEN 'collected' WHEN (SELECT amount_paid>0 FROM invoices WHERE id=i.id) THEN 'partially_collected' ELSE 'invoiced' END)::public.assignment_deliverable_billing_status FROM invoice_line_items_operational l WHERE l.invoice_id=i.id AND d.id=l.assignment_deliverable_id;
 UPDATE campaign_lines SET billing_status=(CASE WHEN (SELECT amount_paid>=total FROM invoices WHERE id=i.id) THEN 'paid' ELSE 'partially_paid' END)::public.campaign_line_billing_status WHERE invoice_id=i.id AND billing_status IN ('invoiced','partially_paid','paid');
 PERFORM set_config('thinkway.applying_advance',coalesce(previous_guard,''),true);
 RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.settle_collection_advance_internal(uuid,uuid,numeric,integer) FROM PUBLIC,authenticated;

CREATE FUNCTION public.settle_collection_advance(p_id uuid,p_invoice uuid,p_amount numeric,p_revision integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (is_admin() OR has_permission('collections.write')) THEN RAISE EXCEPTION 'Collections write access required'; END IF;
 RETURN settle_collection_advance_internal(p_id,p_invoice,p_amount,p_revision);
END $$;
REVOKE ALL ON FUNCTION public.settle_collection_advance(uuid,uuid,numeric,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_collection_advance(uuid,uuid,numeric,integer) TO authenticated;

CREATE FUNCTION public.apply_campaign_advances(p_invoice uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i invoices%ROWTYPE; p payments%ROWTYPE; available numeric;
BEGIN
 IF current_setting('thinkway.applying_advance',true)='yes' THEN RETURN; END IF;
 SELECT * INTO i FROM invoices WHERE id=p_invoice FOR UPDATE;
 IF i.campaign_header_id IS NULL OR i.issue_date IS NULL OR i.status='void' OR coalesce(i.regeneration_status,'active')<>'active' OR i.total<=i.amount_paid THEN RETURN; END IF;
 FOR p IN SELECT * FROM payments WHERE invoice_id IS NULL AND status='completed' AND client_id=i.client_id AND advance_campaign_id=i.campaign_header_id AND currency=i.currency ORDER BY paid_at,created_at,id FOR UPDATE LOOP
   SELECT total-amount_paid INTO available FROM invoices WHERE id=i.id;
   EXIT WHEN available<=0;
   PERFORM settle_collection_advance_internal(p.id,i.id,least(p.amount,available),p.revision);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.apply_campaign_advances(uuid) FROM PUBLIC,authenticated;
CREATE FUNCTION public.lock_campaign_advance_scope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.campaign_header_id IS NOT NULL AND current_setting('thinkway.applying_advance',true) IS DISTINCT FROM 'yes' THEN
   PERFORM 1 FROM campaign_headers WHERE id=NEW.campaign_header_id FOR UPDATE;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.lock_campaign_advance_scope() FROM PUBLIC,authenticated;
CREATE TRIGGER lock_campaign_advance_scope BEFORE INSERT OR UPDATE OF issue_date,total,regeneration_status,campaign_header_id ON invoices FOR EACH ROW EXECUTE FUNCTION public.lock_campaign_advance_scope();
CREATE FUNCTION public.invoice_apply_campaign_advances() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- Payment status changes alone are not a new invoice issue. Avoid consuming
 -- another advance while a user is correcting or deleting an actual receipt.
 IF TG_OP='UPDATE' AND NEW.issue_date IS NOT DISTINCT FROM OLD.issue_date AND NEW.total IS NOT DISTINCT FROM OLD.total AND NEW.regeneration_status IS NOT DISTINCT FROM OLD.regeneration_status AND NEW.campaign_header_id IS NOT DISTINCT FROM OLD.campaign_header_id AND NOT (OLD.status='void' AND NEW.status<>'void') THEN RETURN NEW; END IF;
 PERFORM apply_campaign_advances(NEW.id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.invoice_apply_campaign_advances() FROM PUBLIC,authenticated;
CREATE TRIGGER apply_campaign_advances_after_issue AFTER INSERT OR UPDATE OF issue_date,total,status,regeneration_status,campaign_header_id ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.invoice_apply_campaign_advances();

CREATE FUNCTION public.record_collection_advance(p_request uuid,p_client uuid,p_campaign uuid,p_amount numeric,p_currency text,p_date date,p_method text,p_reference text,p_notes text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result_id uuid; candidate record;
BEGIN
 IF auth.uid() IS NULL OR NOT (is_admin() OR has_permission('collections.write')) THEN RAISE EXCEPTION 'Collections write access required'; END IF;
 IF p_request IS NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_date IS NULL OR p_date>CURRENT_DATE OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' OR length(coalesce(p_notes,''))>2000 OR length(coalesce(p_reference,''))>120 THEN RAISE EXCEPTION 'Check the advance amount, currency, date and details'; END IF;
 IF NOT EXISTS(SELECT 1 FROM clients WHERE id=p_client) OR (p_campaign IS NOT NULL AND NOT EXISTS(SELECT 1 FROM campaign_headers WHERE id=p_campaign AND client_id=p_client)) THEN RAISE EXCEPTION 'Choose a campaign belonging to this client'; END IF;
 IF p_campaign IS NOT NULL THEN PERFORM 1 FROM campaign_headers WHERE id=p_campaign FOR UPDATE; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 SELECT id INTO result_id FROM payments WHERE receipt_request_id=p_request AND recorded_by=auth.uid();
 IF result_id IS NOT NULL THEN RETURN result_id; END IF;
 INSERT INTO payments(client_id,amount,currency,status,payment_method,reference_number,paid_at,notes,recorded_by,advance_campaign_id,receipt_request_id,metadata)
 VALUES(p_client,p_amount,p_currency,'completed',p_method::payment_method,nullif(trim(p_reference),''),p_date::timestamp AT TIME ZONE 'UTC',nullif(trim(p_notes),''),auth.uid(),p_campaign,p_request,jsonb_build_object('original_advance_amount',p_amount)) RETURNING id INTO result_id;
 INSERT INTO collection_audit_logs(entity_type,entity_id,action,actor_id,metadata) VALUES('payment',result_id,'advance_recorded',auth.uid(),jsonb_build_object('amount',p_amount,'campaign_id',p_campaign,'client_id',p_client));
 IF p_campaign IS NOT NULL THEN
   FOR candidate IN SELECT id FROM invoices WHERE campaign_header_id=p_campaign AND client_id=p_client AND currency=p_currency AND status<>'void' AND coalesce(regeneration_status,'active')='active' AND issue_date IS NOT NULL AND total>amount_paid ORDER BY issue_date,created_at,id LOOP
     PERFORM apply_campaign_advances(candidate.id);
   END LOOP;
 END IF;
 RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.record_collection_advance(uuid,uuid,uuid,numeric,text,date,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_collection_advance(uuid,uuid,uuid,numeric,text,date,text,text,text) TO authenticated;
COMMIT;
