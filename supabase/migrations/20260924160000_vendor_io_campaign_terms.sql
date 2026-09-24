ALTER TABLE public.vendor_ios
  ADD COLUMN IF NOT EXISTS compliance_country_code text
    CHECK (compliance_country_code IN ('AE', 'EG'));
COMMENT ON COLUMN public.vendor_ios.compliance_country_code IS
  'Local compliance clause override for this IO only. NULL inherits creator CRM country; unsupported/missing CRM countries use the existing Egypt clause.';

-- A stored PDF must not hide edits. Live preview/download and the next normal
-- document generation use the saved terms, without changing workflow or delivery.
CREATE OR REPLACE FUNCTION public.invalidate_vendor_io_terms_documents()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF ROW(NEW.usage_rights, NEW.special_payment_terms, NEW.compliance_country_code,
         NEW.terms_text, NEW.exclusivity)
     IS DISTINCT FROM
     ROW(OLD.usage_rights, OLD.special_payment_terms, OLD.compliance_country_code,
         OLD.terms_text, OLD.exclusivity) THEN
    NEW.terms_html := NULL;
    NEW.generated_html_url := NULL;
    NEW.generated_pdf_url := NULL;
    NEW.document_generated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS invalidate_vendor_io_terms_documents ON public.vendor_ios;
CREATE TRIGGER invalidate_vendor_io_terms_documents
BEFORE UPDATE OF usage_rights, special_payment_terms, compliance_country_code, terms_text, exclusivity
ON public.vendor_ios FOR EACH ROW EXECUTE FUNCTION public.invalidate_vendor_io_terms_documents();
NOTIFY pgrst, 'reload schema';
