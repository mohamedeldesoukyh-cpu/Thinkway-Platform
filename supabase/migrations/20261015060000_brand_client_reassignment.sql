BEGIN;
CREATE TABLE IF NOT EXISTS public.brand_client_reassignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand_id uuid NOT NULL REFERENCES public.brands(id),
 previous_client_id uuid NOT NULL, client_id uuid NOT NULL, actor_id uuid NOT NULL,
 transaction_id bigint NOT NULL DEFAULT txid_current(), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_client_reassignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_client_reassignments FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.relabel_brand_client_json(value jsonb, previous_client jsonb, next_client jsonb, context text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE result jsonb; key text; child jsonb;
BEGIN
 IF value IS NULL THEN RETURN NULL; END IF;
 IF jsonb_typeof(value)='object' THEN
 result:='{}'::jsonb;
 FOR key,child IN SELECT * FROM jsonb_each(value) LOOP
 result:=result||jsonb_build_object(key,public.relabel_brand_client_json(child,previous_client,next_client, CASE WHEN context IN ('client','clients','legalEntity','legal_entity') THEN 'client.'||key ELSE key END));
 END LOOP; RETURN result;
 ELSIF jsonb_typeof(value)='array' THEN
 SELECT coalesce(jsonb_agg(public.relabel_brand_client_json(v,previous_client,next_client,context)),'[]'::jsonb) INTO result FROM jsonb_array_elements(value) v;
 RETURN result;
 ELSIF value=previous_client->'id' THEN RETURN next_client->'id';
 ELSIF context IN ('client_name','clientName','client_label','clientLabel','client.name') AND value=previous_client->'name' THEN RETURN next_client->'name';
 ELSIF context IN ('client.legal_name','client.legalName','clientLegalName') AND value=previous_client->'legal_name' THEN RETURN coalesce(next_client->'legal_name',next_client->'name');
 END IF; RETURN value;
END $$;
REVOKE ALL ON FUNCTION public.relabel_brand_client_json(jsonb,jsonb,jsonb,text) FROM PUBLIC;

-- The existing deletion guard remains intact. Reparenting is validated and cascaded
-- by one transaction; direct brand updates receive the same checks as the UI.
DROP TRIGGER protect_brand_dependencies ON public.brands;
CREATE TRIGGER protect_brand_dependencies BEFORE DELETE ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.guard_client_entity_dependencies();

CREATE OR REPLACE FUNCTION public.reassign_brand_client_records() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE campaign_ids uuid[]; invoice_ids uuid[]; legacy_ids uuid[]; payment_ids uuid[]; r record; old_client public.clients%ROWTYPE; new_client public.clients%ROWTYPE;
BEGIN
 IF NEW.client_id IS NOT DISTINCT FROM OLD.client_id THEN RETURN NEW; END IF;
 IF auth.uid() IS NULL OR NOT coalesce(public.is_internal_user(),false)
 OR NOT coalesce(public.has_permission('clients.write'),false)
 OR NOT coalesce(public.has_permission('invoices.write'),false)
 OR NOT coalesce(public.can_access_client(OLD.client_id),false)
 OR NOT coalesce(public.can_access_client(NEW.client_id),false)
 OR (public.get_user_role_slug() IN ('super_admin','admin','finance') AND coalesce(auth.jwt()->>'aal','')<>'aal2') THEN
 RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Client and invoice write access is required to change a brand legal entity.';
 END IF;
 SELECT * INTO STRICT old_client FROM public.clients WHERE id=OLD.client_id;
 SELECT * INTO STRICT new_client FROM public.clients WHERE id=NEW.client_id FOR KEY SHARE;
 IF new_client.status='archived' THEN RAISE EXCEPTION 'An archived client cannot receive a brand.'; END IF;
 -- Serialize linked writes during this rare administrative operation.
 LOCK TABLE public.campaign_headers, public.invoices, public.invoice_line_items, public.invoice_line_items_operational, public.invoice_lines, public.payments, public.payment_allocations IN SHARE ROW EXCLUSIVE MODE;
 SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO campaign_ids FROM public.campaign_headers WHERE brand_id=NEW.id;
 SELECT coalesce(array_agg(DISTINCT id),ARRAY[]::uuid[]) INTO invoice_ids FROM public.invoices i
 WHERE i.campaign_header_id=ANY(campaign_ids)
 OR EXISTS(SELECT 1 FROM public.invoice_line_items l WHERE l.invoice_id=i.id AND l.campaign_header_id=ANY(campaign_ids))
 OR EXISTS(SELECT 1 FROM public.invoice_line_items_operational l WHERE l.invoice_id=i.id AND l.campaign_header_id=ANY(campaign_ids))
 OR EXISTS(SELECT 1 FROM public.invoice_lines l WHERE l.invoice_id=i.id AND l.campaign_header_id=ANY(campaign_ids));
 IF EXISTS(SELECT 1 FROM public.invoices WHERE id=ANY(invoice_ids) AND campaign_header_id IS NOT NULL AND NOT campaign_header_id=ANY(campaign_ids))
 OR EXISTS(SELECT 1 FROM public.invoice_line_items WHERE invoice_id=ANY(invoice_ids) AND campaign_header_id IS NOT NULL AND NOT campaign_header_id=ANY(campaign_ids))
 OR EXISTS(SELECT 1 FROM public.invoice_line_items_operational WHERE invoice_id=ANY(invoice_ids) AND campaign_header_id IS NOT NULL AND NOT campaign_header_id=ANY(campaign_ids))
 OR EXISTS(SELECT 1 FROM public.invoice_lines WHERE invoice_id=ANY(invoice_ids) AND campaign_header_id IS NOT NULL AND NOT campaign_header_id=ANY(campaign_ids)) THEN
 RAISE EXCEPTION 'A shared invoice includes another brand. Separate that invoice before changing the legal entity.';
 END IF;
 SELECT coalesce(array_agg(DISTINCT p.id),ARRAY[]::uuid[]) INTO payment_ids FROM public.payments p WHERE p.invoice_id=ANY(invoice_ids) OR p.advance_campaign_id=ANY(campaign_ids) OR EXISTS(SELECT 1 FROM public.payment_allocations a WHERE a.payment_id=p.id AND a.invoice_id=ANY(invoice_ids));
 IF EXISTS(SELECT 1 FROM public.payments WHERE id=ANY(payment_ids) AND ((invoice_id IS NOT NULL AND NOT invoice_id=ANY(invoice_ids)) OR (advance_campaign_id IS NOT NULL AND NOT advance_campaign_id=ANY(campaign_ids)))) OR EXISTS(SELECT 1 FROM public.payment_allocations WHERE payment_id=ANY(payment_ids) AND NOT invoice_id=ANY(invoice_ids)) THEN RAISE EXCEPTION 'A shared payment covers another brand. Separate its allocations before changing the legal entity.'; END IF;
 INSERT INTO public.brand_client_reassignments(brand_id,previous_client_id,client_id,actor_id) VALUES(NEW.id,OLD.client_id,NEW.client_id,auth.uid());
 SELECT coalesce(array_agg(DISTINCT campaign_id),ARRAY[]::uuid[]) INTO legacy_ids FROM public.invoices WHERE id=ANY(invoice_ids) AND campaign_id IS NOT NULL;
 IF EXISTS(SELECT 1 FROM public.invoices WHERE campaign_id=ANY(legacy_ids) AND NOT id=ANY(invoice_ids)) THEN RAISE EXCEPTION 'A legacy campaign has invoices outside this brand. Reassign it separately first.'; END IF;
 UPDATE public.campaigns SET client_id=NEW.client_id WHERE id=ANY(legacy_ids);
 UPDATE public.campaign_headers SET client_id=NEW.client_id,group_id=NEW.group_id WHERE id=ANY(campaign_ids);
 -- All current brand-scoped records, including future tables with these keys.
 FOR r IN SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t USING(table_schema,table_name)
 WHERE c.table_schema='public' AND c.column_name='brand_id' AND t.table_type='BASE TABLE'
 AND c.table_name NOT IN ('brand_client_reassignments','campaign_headers')
 AND EXISTS(SELECT 1 FROM information_schema.columns x WHERE x.table_schema=c.table_schema AND x.table_name=c.table_name AND x.column_name='client_id') LOOP
 EXECUTE format('UPDATE public.%I SET client_id=$1 WHERE brand_id=$2',r.table_name) USING NEW.client_id,NEW.id;
 END LOOP;
 UPDATE public.invoices SET client_id=NEW.client_id WHERE id=ANY(invoice_ids);
 UPDATE public.client_ios SET client_id=NEW.client_id,generated_html_url=NULL,generated_pdf_url=NULL,document_generated_at=NULL WHERE campaign_header_id=ANY(campaign_ids);
 UPDATE public.client_credit_notes SET client_id=NEW.client_id WHERE campaign_header_id=ANY(campaign_ids) OR invoice_id=ANY(invoice_ids);
 UPDATE public.client_debit_notes SET client_id=NEW.client_id WHERE campaign_header_id=ANY(campaign_ids) OR invoice_id=ANY(invoice_ids);
 UPDATE public.finance_documents SET client_id=NEW.client_id WHERE campaign_header_id=ANY(campaign_ids) OR (source_table='invoices' AND source_id=ANY(invoice_ids)) OR (source_table='client_credit_notes' AND source_id IN(SELECT id FROM public.client_credit_notes WHERE campaign_header_id=ANY(campaign_ids) OR invoice_id=ANY(invoice_ids))) OR (source_table='client_debit_notes' AND source_id IN(SELECT id FROM public.client_debit_notes WHERE campaign_header_id=ANY(campaign_ids) OR invoice_id=ANY(invoice_ids)));
 UPDATE public.payments SET client_id=NEW.client_id WHERE id=ANY(payment_ids);
 UPDATE public.campaign_client_reviews SET client_label=new_client.name WHERE campaign_header_id=ANY(campaign_ids)
 OR quotation_id IN(SELECT id FROM public.quotations WHERE brand_id=NEW.id)
 OR shortlist_id IN(SELECT id FROM public.discovery_shortlists WHERE brand_id=NEW.id);
 UPDATE public.portal_notifications SET client_id=NEW.client_id WHERE campaign_header_id=ANY(campaign_ids);
 UPDATE public.portal_uploads SET client_id=NEW.client_id WHERE campaign_header_id=ANY(campaign_ids);
 UPDATE public.vendor_ios SET generated_html_url=NULL,generated_pdf_url=NULL,document_generated_at=NULL WHERE campaign_header_id=ANY(campaign_ids);
 UPDATE public.campaign_client_reviews SET source_snapshot=public.relabel_brand_client_json(source_snapshot,to_jsonb(old_client),to_jsonb(new_client)) WHERE campaign_header_id=ANY(campaign_ids) OR quotation_id IN(SELECT id FROM public.quotations WHERE brand_id=NEW.id) OR shortlist_id IN(SELECT id FROM public.discovery_shortlists WHERE brand_id=NEW.id);
 UPDATE public.campaign_object_versions SET snapshot=public.relabel_brand_client_json(snapshot,to_jsonb(old_client),to_jsonb(new_client)) WHERE campaign_object_id IN(SELECT id FROM public.campaign_objects WHERE campaign_header_id=ANY(campaign_ids) UNION SELECT campaign_object_id FROM public.quotations WHERE brand_id=NEW.id);
 UPDATE public.campaign_commercial_snapshots SET payload=public.relabel_brand_client_json(payload,to_jsonb(old_client),to_jsonb(new_client)) WHERE campaign_header_id=ANY(campaign_ids) OR quotation_id IN(SELECT id FROM public.quotations WHERE brand_id=NEW.id);
 UPDATE public.invoice_versions SET snapshot=public.relabel_brand_client_json(snapshot,to_jsonb(old_client),to_jsonb(new_client)) WHERE invoice_id=ANY(invoice_ids);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reassign_brand_client_records() FROM PUBLIC;
DROP TRIGGER IF EXISTS reassign_brand_client_records ON public.brands;
CREATE TRIGGER reassign_brand_client_records AFTER UPDATE OF client_id ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.reassign_brand_client_records();

-- Retain issued-amount protection. Client identity may change only inside the
-- authenticated brand cascade, evidenced by an audit row in this transaction.
CREATE OR REPLACE FUNCTION public.guard_issued_invoice_amounts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE k text; reassignment boolean:=false;
BEGIN
 IF OLD.amounts_finalized_at IS NOT NULL OR OLD.status::text <> 'draft' THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Issued invoices cannot be deleted; retain the invoice and use a credit/debit note.'; END IF;
  IF NEW.amounts_finalized_at IS DISTINCT FROM OLD.amounts_finalized_at THEN RAISE EXCEPTION 'Issued invoice amount protection cannot be removed or changed.'; END IF;
  IF pg_trigger_depth()>1 THEN
   SELECT EXISTS(SELECT 1 FROM public.brand_client_reassignments a
    WHERE a.transaction_id=txid_current() AND a.actor_id=auth.uid() AND a.previous_client_id=OLD.client_id AND a.client_id=NEW.client_id
    AND EXISTS(SELECT 1 FROM public.campaign_headers h WHERE h.brand_id=a.brand_id AND (h.id=OLD.campaign_header_id
      OR h.id IN(SELECT campaign_header_id FROM public.invoice_line_items WHERE invoice_id=OLD.id)
      OR h.id IN(SELECT campaign_header_id FROM public.invoice_line_items_operational WHERE invoice_id=OLD.id)
      OR h.id IN(SELECT campaign_header_id FROM public.invoice_lines WHERE invoice_id=OLD.id)))) INTO reassignment;
  END IF;
  FOREACH k IN ARRAY ARRAY['subtotal','tax_amount','total','revenue_before_vat','revenue_vat_amount','revenue_after_vat','currency','client_id','campaign_header_id','document_number','issue_date','billing_country_code'] LOOP
   IF k='client_id' AND reassignment THEN CONTINUE; END IF;
   IF to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k THEN RAISE EXCEPTION 'Issued invoice financial values cannot be changed. Use a credit/debit note.'; END IF;
  END LOOP;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.status::text <> 'draft' AND NEW.amounts_finalized_at IS NULL THEN NEW.amounts_finalized_at:=now(); END IF;
 RETURN NEW;
END $$;
COMMIT;
