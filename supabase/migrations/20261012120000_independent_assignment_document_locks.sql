BEGIN;

-- Generated documents lock their own commercial side, including reporting FX.
-- Pending-regeneration invoices retain historical items but no longer lock edits.
CREATE OR REPLACE FUNCTION public.assignment_document_locks(p_line uuid)
RETURNS TABLE(cost_locked boolean, client_locked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(
   SELECT 1 FROM vendor_ios v WHERE NOT coalesce(v.is_superseded,false)
   AND v.status::text NOT IN ('draft','cancelled','void','voided')
   AND (v.id IN (SELECT vendor_io_id FROM campaign_lines WHERE id=p_line)
     OR v.id IN (SELECT vendor_io_id FROM vendor_io_lines WHERE campaign_line_id=p_line)
     OR v.assignment_id IN (SELECT id FROM campaign_influencers WHERE campaign_line_id=p_line))
 ), EXISTS(
   SELECT 1 FROM invoices i WHERE i.status::text NOT IN ('void','cancelled','voided')
   AND coalesce(i.regeneration_status,'active')<>'pending_regeneration'
   AND (i.id IN (SELECT invoice_id FROM campaign_lines WHERE id=p_line)
     OR i.id IN (SELECT invoice_id FROM invoice_line_items_operational WHERE campaign_line_id=p_line)
     OR i.id IN (SELECT invoice_id FROM invoice_lines WHERE campaign_line_id=p_line))
 );
$$;
REVOKE ALL ON FUNCTION public.assignment_document_locks(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.assignment_commercial_locks(p_lines uuid[])
RETURNS TABLE(line_id uuid, cost_locked boolean, client_locked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT l.id,d.cost_locked,d.client_locked FROM campaign_lines l
 CROSS JOIN LATERAL assignment_document_locks(l.id) d
 WHERE l.id=ANY(p_lines) AND auth.uid() IS NOT NULL AND can_access_campaign_header(l.campaign_header_id);
$$;
REVOKE ALL ON FUNCTION public.assignment_commercial_locks(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assignment_commercial_locks(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_assignment_document_commercials()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE before_row jsonb:=to_jsonb(OLD); after_row jsonb:=to_jsonb(NEW);
 line_id uuid; locks record; key text; client_changed boolean:=false; cost_changed boolean:=false;
BEGIN
 FOREACH key IN ARRAY ARRAY['revenue','revenue_before_vat','unit_revenue','revenue_per_post',
   'usage_rights_amount','agency_fee_percent','agency_fee_amount','revenue_vat_percent','revenue_vat_exempt',
   'revenue_fx_override','currency_code','quantity'] LOOP
   client_changed:=client_changed OR (before_row->key IS DISTINCT FROM after_row->key);
 END LOOP;
 FOREACH key IN ARRAY ARRAY['cost','cost_before_vat','unit_cost','cost_per_post','cost_received',
   'cost_received_currency','usage_rights_cost','cost_vat_percent','cost_vat_exempt','cost_fx_override',
   'fx_rate','fx_from_currency','fx_to_currency','currency_code','quantity'] LOOP
   cost_changed:=cost_changed OR (before_row->key IS DISTINCT FROM after_row->key);
 END LOOP;
 IF NOT client_changed AND NOT cost_changed THEN RETURN NEW; END IF;
 line_id:=CASE WHEN TG_TABLE_NAME='campaign_lines' THEN OLD.id ELSE (before_row->>'campaign_line_id')::uuid END;
 SELECT * INTO locks FROM assignment_document_locks(line_id);
 IF client_changed AND locks.client_locked THEN
   RAISE EXCEPTION 'Client amounts, currency, fees, VAT and FX are locked. Ungenerate the linked client invoice before editing the client side.' USING ERRCODE='check_violation';
 END IF;
 IF cost_changed AND locks.cost_locked THEN
   RAISE EXCEPTION 'Vendor costs, currency, VAT and FX are locked. Ungenerate the Vendor IO before editing the cost side.' USING ERRCODE='check_violation';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_assignment_document_commercials() FROM PUBLIC;
CREATE TRIGGER zz_guard_assignment_document_commercials BEFORE UPDATE ON public.campaign_lines
 FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_document_commercials();
CREATE TRIGGER zz_guard_assignment_document_commercials BEFORE UPDATE ON public.assignment_deliverables
 FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_document_commercials();
CREATE TRIGGER zz_guard_assignment_document_commercials BEFORE UPDATE ON public.assignment_post_schedule
 FOR EACH ROW EXECUTE FUNCTION public.guard_assignment_document_commercials();
NOTIFY pgrst,'reload schema';
COMMIT;
