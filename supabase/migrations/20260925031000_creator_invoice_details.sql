BEGIN;
CREATE FUNCTION public.update_creator_invoice_details(p_id uuid,p_revision integer,p_details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old public.creator_supplier_invoices; a public.campaign_influencers; file_path text:=nullif(p_details->>'storage_path','');
BEGIN
 SELECT * INTO old FROM creator_supplier_invoices WHERE id=p_id FOR UPDATE;
 SELECT * INTO a FROM campaign_influencers WHERE id=old.assignment_id;
 IF old.id IS NULL OR auth.uid() IS NULL OR NOT can_manage_creator_payments(a.campaign_header_id,true) THEN RAISE EXCEPTION 'Finance access required'; END IF;
 IF old.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Invoice changed. Refresh before saving'; END IF;
 IF length(trim(coalesce(p_details->>'supplier_name','')))=0 OR length(p_details->>'supplier_name')>200 OR length(p_details->>'supplier_address')>1000 OR length(p_details->>'tax_registration_number')>100 OR length(p_details->>'description')>2000 OR length(p_details->>'notes')>2000 THEN RAISE EXCEPTION 'Check invoice details'; END IF;
 IF file_path IS NOT NULL AND (split_part(file_path,'/',1)<>auth.uid()::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='creator-invoices' AND name=file_path)) THEN RAISE EXCEPTION 'Invalid invoice attachment'; END IF;
 UPDATE creator_supplier_invoices SET supplier_name=trim(p_details->>'supplier_name'),supplier_address=p_details->>'supplier_address',tax_registration_number=p_details->>'tax_registration_number',description=p_details->>'description',notes=p_details->>'notes',due_date=nullif(p_details->>'due_date','')::date,storage_path=coalesce(file_path,storage_path),revision=revision+1 WHERE id=p_id;
 -- Amounts, tax date, tax country and VAT remain owned by the payment editor.
END $$;
REVOKE ALL ON FUNCTION public.update_creator_invoice_details(uuid,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_creator_invoice_details(uuid,integer,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
