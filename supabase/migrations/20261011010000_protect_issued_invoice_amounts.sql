-- Generated invoices may still have status=draft. Seal their financial values
-- independently of status. Apply on dev and verify before production.
BEGIN;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amounts_finalized_at timestamptz;

UPDATE public.invoices i
SET amounts_finalized_at = now()
WHERE amounts_finalized_at IS NULL
  AND (i.issue_date IS NOT NULL OR i.status::text <> 'draft'
       OR EXISTS (SELECT 1 FROM public.invoice_line_items l WHERE l.invoice_id = i.id));

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
    FOREACH k IN ARRAY ARRAY['subtotal','tax_amount','total','currency','client_id',
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

CREATE OR REPLACE FUNCTION public.guard_issued_invoice_lines()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE old_parent uuid; new_parent uuid; parent record;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_parent := OLD.invoice_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_parent := NEW.invoice_id; END IF;
  -- Lock both parents in deterministic order: moving a line cannot evade the
  -- protection, and finalization cannot race a line write.
  FOR parent IN SELECT id, amounts_finalized_at, status FROM public.invoices
    WHERE id = old_parent OR id = new_parent ORDER BY id FOR UPDATE LOOP
    IF parent.amounts_finalized_at IS NOT NULL OR parent.status::text <> 'draft' THEN
      RAISE EXCEPTION 'Issued invoice lines cannot be added, changed or removed. Create a new invoice or credit/debit note.';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_issued_invoice_amounts
BEFORE UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.guard_issued_invoice_amounts();
CREATE TRIGGER protect_issued_invoice_lines
BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_line_items
FOR EACH ROW EXECUTE FUNCTION public.guard_issued_invoice_lines();
REVOKE ALL ON FUNCTION public.guard_issued_invoice_amounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_issued_invoice_lines() FROM PUBLIC;
COMMIT;
