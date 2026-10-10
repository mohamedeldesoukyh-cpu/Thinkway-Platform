-- Protect legacy financial aliases used by invoice reports as well as canonical totals.
BEGIN;
CREATE OR REPLACE FUNCTION public.guard_issued_invoice_amounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE k text;
BEGIN
  IF OLD.amounts_finalized_at IS NOT NULL OR OLD.status::text <> 'draft' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Issued invoices cannot be deleted; retain the invoice and use a credit/debit note.';
    END IF;
    IF NEW.amounts_finalized_at IS DISTINCT FROM OLD.amounts_finalized_at THEN
      RAISE EXCEPTION 'Issued invoice amount protection cannot be removed or changed.';
    END IF;
    FOREACH k IN ARRAY ARRAY['subtotal','tax_amount','total','revenue_before_vat','revenue_vat_amount','revenue_after_vat','currency','client_id',
      'campaign_header_id','document_number','issue_date','billing_country_code'] LOOP
      IF to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k THEN
        RAISE EXCEPTION 'Issued invoice financial values cannot be changed. Use a credit/debit note.';
      END IF;
    END LOOP;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.status::text <> 'draft' AND NEW.amounts_finalized_at IS NULL THEN
    NEW.amounts_finalized_at := now();
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
