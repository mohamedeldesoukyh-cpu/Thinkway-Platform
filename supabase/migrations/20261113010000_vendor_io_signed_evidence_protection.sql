-- Apply after 20261111020000_vendor_io_electronic_signatures.sql.
-- Restrictive policies preserve all existing bucket authorization, while reserving
-- the signed namespace for the validated server-side signing workflow.
CREATE POLICY vendor_io_signed_storage_insert_guard ON storage.objects
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id <> 'vendor-io-documents' OR name !~ '^[^/]+/signed/');

CREATE POLICY vendor_io_signed_storage_update_guard ON storage.objects
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (bucket_id <> 'vendor-io-documents' OR name !~ '^[^/]+/signed/')
WITH CHECK (bucket_id <> 'vendor-io-documents' OR name !~ '^[^/]+/signed/');

CREATE POLICY vendor_io_signed_storage_delete_guard ON storage.objects
AS RESTRICTIVE FOR DELETE TO authenticated
USING (bucket_id <> 'vendor-io-documents' OR name !~ '^[^/]+/signed/');

CREATE OR REPLACE FUNCTION public.guard_signed_vendor_io_terms()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE signed_path text;
BEGIN
  SELECT signed_pdf_path INTO signed_path FROM public.vendor_io_signatures WHERE vendor_io_id=OLD.id;
  IF FOUND AND (
    ROW(NEW.terms_text,NEW.terms_html,NEW.usage_rights,NEW.exclusivity,NEW.special_payment_terms,NEW.compliance_country_code,NEW.amount,NEW.currency_code,NEW.revision_number,NEW.influencer_id,NEW.campaign_header_id)
    IS DISTINCT FROM ROW(OLD.terms_text,OLD.terms_html,OLD.usage_rights,OLD.exclusivity,OLD.special_payment_terms,OLD.compliance_country_code,OLD.amount,OLD.currency_code,OLD.revision_number,OLD.influencer_id,OLD.campaign_header_id)
    OR NEW.generated_pdf_url IS DISTINCT FROM signed_path
  ) THEN
    RAISE EXCEPTION 'This IO is signed. Create a revision to change its agreed terms.';
  END IF;
  RETURN NEW;
END $$;

NOTIFY pgrst,'reload schema';
