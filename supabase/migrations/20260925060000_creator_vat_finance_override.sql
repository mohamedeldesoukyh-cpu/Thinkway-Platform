BEGIN;
-- A scoped override for one creator VAT save, never a persistent unlock.
CREATE FUNCTION public.save_creator_payment_invoice(p_assignment uuid,p_number text,p_date date,p_country text,p_vat boolean,p_revision integer,p_expected_vat numeric,p_override_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.campaign_influencers; l public.campaign_lines; requires_override boolean;
 reason text:=nullif(trim(p_override_reason),''); rate numeric:=CASE WHEN p_vat THEN 14 ELSE 0 END;
BEGIN
 SELECT * INTO a FROM campaign_influencers WHERE id=p_assignment;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT can_manage_creator_payments(a.campaign_header_id,true) THEN RAISE EXCEPTION 'Finance access required'; END IF;
 SELECT * INTO l FROM campaign_lines WHERE id=a.campaign_line_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment cost line missing'; END IF;
 SELECT * INTO a FROM campaign_influencers WHERE id=p_assignment FOR UPDATE;
 requires_override:=rate IS DISTINCT FROM a.cost_vat_percent AND (l.cost_locked OR l.vat_locked OR l.vendor_assignment_locked);
 IF requires_override THEN
   IF NOT (public.is_admin() OR public.has_permission('finance.override')) THEN RAISE EXCEPTION 'Finance override permission is required to correct VAT on this locked assignment'; END IF;
   IF reason IS NULL OR length(reason)<5 OR length(reason)>1000 THEN RAISE EXCEPTION 'Enter a Finance correction reason (5–1000 characters)'; END IF;
   UPDATE campaign_lines SET finance_override_until=clock_timestamp()+interval '5 minutes' WHERE id=l.id;
 END IF;
 -- The existing save and synchronization triggers retain stale-data, export,
 -- legacy-payment and paid-balance guards. Any failure rolls back the override.
 PERFORM public.save_creator_payment_invoice(p_assignment,p_number,p_date,p_country,p_vat,p_revision,p_expected_vat);
 IF requires_override THEN
   UPDATE campaign_lines SET finance_override_until=l.finance_override_until WHERE id=l.id;
   INSERT INTO finance_override_logs(entity_type,entity_id,override_type,reason,granted_by,granted_until,metadata)
   VALUES('campaign_line',l.id,'creator_cost_vat_correction',reason,auth.uid(),clock_timestamp(),
     jsonb_build_object('assignment_id',a.id,'invoice_number',p_number,'old_vat_percent',a.cost_vat_percent,'new_vat_percent',rate,'old_cost_total',a.cost_after_vat,'new_cost_total',l.cost_before_vat+round(l.cost_before_vat*rate/100,2),'scope','single_creator_invoice_save'));
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_creator_payment_invoice(uuid,text,date,text,boolean,integer,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_creator_payment_invoice(uuid,text,date,text,boolean,integer,numeric,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
