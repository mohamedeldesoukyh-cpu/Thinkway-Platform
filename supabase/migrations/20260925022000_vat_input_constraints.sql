BEGIN;
ALTER TABLE public.creator_supplier_invoices ADD CONSTRAINT received_invoice_details CHECK(status<>'received' OR (invoice_number IS NOT NULL AND length(trim(invoice_number))>0 AND invoice_date IS NOT NULL));
ALTER TABLE public.creator_supplier_invoices ADD CONSTRAINT supplier_invoice_notes_length CHECK(length(coalesce(notes,''))<=2000 AND length(coalesce(invoice_number,''))<=120);
ALTER TABLE public.vat_authority_payments ADD CONSTRAINT authority_details_length CHECK(length(reference)<=120 AND length(authority)<=200 AND length(coalesce(notes,''))<=2000);
COMMIT;
