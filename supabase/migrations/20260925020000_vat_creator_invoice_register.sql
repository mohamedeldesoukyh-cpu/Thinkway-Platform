BEGIN;
CREATE TABLE public.creator_supplier_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL UNIQUE,
 assignment_id uuid NOT NULL REFERENCES public.campaign_influencers(id),
 status text NOT NULL CHECK(status IN ('received','not_received','not_provided')),
 invoice_number text, invoice_date date, due_date date, country_code text NOT NULL CHECK(country_code ~ '^[A-Z]{2}$'),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), supplier_name text NOT NULL,
 supplier_address text, tax_registration_number text, description text,
 subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK(subtotal>=0), vat_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(vat_amount>=0),
 confirmed boolean NOT NULL DEFAULT false, storage_path text, notes text,
 recorded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'received' OR (length(trim(invoice_number))>0 AND invoice_date IS NOT NULL)),
 CHECK(NOT confirmed OR status='received'), CHECK(due_date IS NULL OR invoice_date IS NULL OR due_date>=invoice_date)
);
CREATE UNIQUE INDEX supplier_invoice_number_unique ON public.creator_supplier_invoices(assignment_id,lower(invoice_number)) WHERE status='received';
CREATE TABLE public.vat_authority_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL UNIQUE,
 period date NOT NULL CHECK(extract(day FROM period)=1),country_code text NOT NULL CHECK(country_code ~ '^[A-Z]{2}$'),currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 amount numeric(14,2) NOT NULL CHECK(amount>0), paid_at date NOT NULL CHECK(paid_at<=CURRENT_DATE),
 method text NOT NULL CHECK(method IN ('bank_transfer','wire','check','cash','other')),reference text NOT NULL CHECK(length(trim(reference))>0),
 authority text NOT NULL CHECK(length(trim(authority))>0), notes text,
 recorded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.creator_supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vat_authority_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_invoice_read ON public.creator_supplier_invoices FOR SELECT TO authenticated USING(public.is_admin() OR public.has_permission('finance.read') OR public.has_permission('finance.write'));
CREATE POLICY supplier_invoice_insert ON public.creator_supplier_invoices FOR INSERT TO authenticated WITH CHECK(recorded_by=auth.uid() AND (public.is_admin() OR public.has_permission('finance.write')) AND EXISTS(SELECT 1 FROM public.campaign_influencers a WHERE a.id=assignment_id AND public.can_manage_creator_payments(a.campaign_header_id,true)));
CREATE POLICY vat_payment_read ON public.vat_authority_payments FOR SELECT TO authenticated USING(public.is_admin() OR public.has_permission('finance.read') OR public.has_permission('finance.write'));
CREATE POLICY vat_payment_insert ON public.vat_authority_payments FOR INSERT TO authenticated WITH CHECK(recorded_by=auth.uid() AND (public.is_admin() OR public.has_permission('finance.write')));
GRANT SELECT,INSERT ON public.creator_supplier_invoices,public.vat_authority_payments TO authenticated;
CREATE TRIGGER audit_supplier_invoices AFTER INSERT ON public.creator_supplier_invoices FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();
CREATE TRIGGER audit_vat_authority_payments AFTER INSERT ON public.vat_authority_payments FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('creator-invoices','creator-invoices',false,4194304,ARRAY['application/pdf','image/png','image/jpeg']);
CREATE POLICY creator_invoice_file_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='creator-invoices' AND (public.is_admin() OR public.has_permission('finance.read') OR public.has_permission('finance.write')));
CREATE POLICY creator_invoice_file_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='creator-invoices' AND (storage.foldername(name))[1]=auth.uid()::text AND (public.is_admin() OR public.has_permission('finance.write')));
CREATE POLICY creator_invoice_file_cleanup ON storage.objects FOR DELETE TO authenticated USING(bucket_id='creator-invoices' AND (storage.foldername(name))[1]=auth.uid()::text AND NOT EXISTS(SELECT 1 FROM public.creator_supplier_invoices WHERE storage_path=name));
NOTIFY pgrst,'reload schema';
COMMIT;
