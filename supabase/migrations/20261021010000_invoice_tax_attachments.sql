BEGIN;
CREATE TABLE public.invoice_tax_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invoice_id uuid NOT NULL REFERENCES public.invoices(id),
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 180),
 storage_path text NOT NULL UNIQUE CHECK(storage_path LIKE invoice_id::text || '/' || id::text || '.%'),
 mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 10485760),
 uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 uploaded_at timestamptz,
 removed_at timestamptz
);
CREATE INDEX invoice_tax_attachments_invoice ON public.invoice_tax_attachments(invoice_id);
ALTER TABLE public.invoice_tax_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoice_attachments_read ON public.invoice_tax_attachments FOR SELECT TO authenticated USING (
 public.is_internal_user() AND public.can_read_invoice_line_items(invoice_id)
);
CREATE POLICY invoice_attachments_insert ON public.invoice_tax_attachments FOR INSERT TO authenticated WITH CHECK (
 uploaded_by=auth.uid() AND public.is_internal_user() AND public.can_write_invoice_line_items(invoice_id)
);
CREATE POLICY invoice_attachments_update ON public.invoice_tax_attachments FOR UPDATE TO authenticated USING (
 public.is_internal_user() AND public.can_write_invoice_line_items(invoice_id)
) WITH CHECK (public.is_internal_user() AND public.can_write_invoice_line_items(invoice_id));
GRANT SELECT,INSERT,UPDATE ON public.invoice_tax_attachments TO authenticated;
REVOKE DELETE ON public.invoice_tax_attachments FROM authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('invoice-tax-attachments','invoice-tax-attachments',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp']);
CREATE FUNCTION public.can_access_invoice_tax_attachment(p_path text,p_write boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_internal_user() AND EXISTS(SELECT 1 FROM public.invoice_tax_attachments a
 WHERE a.storage_path=p_path AND a.removed_at IS NULL
 AND CASE WHEN p_write THEN a.uploaded_at IS NULL AND a.uploaded_by=auth.uid() AND public.can_write_invoice_line_items(a.invoice_id)
 ELSE public.can_read_invoice_line_items(a.invoice_id) END);
$$;
REVOKE ALL ON FUNCTION public.can_access_invoice_tax_attachment(text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_invoice_tax_attachment(text,boolean) TO authenticated;
CREATE POLICY invoice_attachment_objects_read ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id='invoice-tax-attachments' AND public.can_access_invoice_tax_attachment(name,false)
);
CREATE POLICY invoice_attachment_objects_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id='invoice-tax-attachments' AND public.can_access_invoice_tax_attachment(name,true)
);
NOTIFY pgrst,'reload schema';
COMMIT;
