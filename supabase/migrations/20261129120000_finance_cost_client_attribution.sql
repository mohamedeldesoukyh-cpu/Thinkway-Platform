BEGIN;
-- Approved analytical attribution is separate from the supplier on the GL line.
CREATE TABLE public.tw_finance_cost_client_attributions (
 company_id uuid NOT NULL REFERENCES public.tw_accounting_companies(id),
 journal_id uuid NOT NULL,
 line_number integer NOT NULL,
 client_id uuid NOT NULL REFERENCES public.clients(id),
 campaign_id uuid NOT NULL REFERENCES public.campaign_headers(id),
 source_line jsonb NOT NULL,
 approved_by uuid NOT NULL REFERENCES public.profiles(id),
 approved_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL CHECK(length(reason)>10),
 PRIMARY KEY(journal_id,line_number),
 FOREIGN KEY(journal_id,line_number) REFERENCES public.tw_accounting_journal_lines(journal_id,line_number),
 CHECK(source_line->>'journal_id'=journal_id::text AND (source_line->>'line_number')::integer=line_number AND source_line->>'company_id'=company_id::text)
);
ALTER TABLE public.tw_finance_cost_client_attributions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tw_finance_cost_client_attributions FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER finance_cost_attribution_audit AFTER INSERT OR UPDATE ON public.tw_finance_cost_client_attributions FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_audit_change();
DO $migration$
DECLARE original text; changed text;
BEGIN
 original:=pg_get_functiondef('public.tw_finance_analysis_snapshot(uuid,date,date,text,text)'::regprocedure);
 changed:=replace(original,'SELECT r.value payload,l.*,j.source_invoice_id','SELECT r.value payload,l.*,to_jsonb(l) allocation_source_line,j.source_invoice_id');
 IF changed=original THEN RAISE EXCEPTION 'Unexpected analysis source definition'; END IF;
 original:=changed;
 changed:=replace(original,'SELECT i.client_id client,i.campaign_header_id campaign FROM invoices i WHERE i.id=e.source_invoice_id',
 'SELECT a.client_id client,a.campaign_id campaign FROM public.tw_finance_cost_client_attributions a JOIN public.campaign_headers h ON h.id=a.campaign_id AND h.client_id=a.client_id WHERE a.company_id=p_company AND a.journal_id=e.journal_id AND a.line_number=e.line_number AND a.source_line=e.allocation_source_line
    UNION ALL
    SELECT i.client_id client,i.campaign_header_id campaign FROM invoices i WHERE i.id=e.source_invoice_id');
 IF changed=original THEN RAISE EXCEPTION 'Unexpected analysis attribution definition'; END IF;
 EXECUTE changed;
END $migration$;
COMMIT;
