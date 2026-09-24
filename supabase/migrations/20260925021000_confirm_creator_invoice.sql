BEGIN;
CREATE OR REPLACE FUNCTION public.confirm_creator_supplier_invoice(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE invoice creator_supplier_invoices%ROWTYPE; campaign uuid;
BEGIN
 SELECT * INTO invoice FROM creator_supplier_invoices WHERE id=p_id FOR UPDATE;
 SELECT campaign_header_id INTO campaign FROM campaign_influencers WHERE id=invoice.assignment_id;
 IF auth.uid() IS NULL OR invoice.id IS NULL OR NOT public.can_manage_creator_payments(campaign,true) THEN RAISE EXCEPTION 'Finance access required';END IF;
 IF invoice.status<>'received' THEN RAISE EXCEPTION 'Receive the invoice before confirming VAT';END IF;
 IF NOT invoice.confirmed THEN
 UPDATE creator_supplier_invoices SET confirmed=true WHERE id=p_id;
 INSERT INTO collection_audit_logs(entity_type,entity_id,action,actor_id,metadata) VALUES('creator_invoice',p_id,'vat_confirmed',auth.uid(),jsonb_build_object('before',to_jsonb(invoice)));
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.confirm_creator_supplier_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_creator_supplier_invoice(uuid) TO authenticated;
COMMIT;
