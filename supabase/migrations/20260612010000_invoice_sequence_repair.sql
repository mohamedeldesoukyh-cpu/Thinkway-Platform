-- Repair invoice serial integrity: compact surviving invoices to INV-YYYY-1..N
-- and align document_sequences.last_value with MAX(serial).

CREATE OR REPLACE FUNCTION public.repair_invoice_sequence_for_year(
  p_year integer,
  p_dry_run boolean DEFAULT true
)
RETURNS TABLE (
  year integer,
  renumbered integer,
  previous_max_serial bigint,
  new_max_serial bigint,
  next_serial bigint,
  applied boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_prefix text := 'INV-' || p_year::text;
  v_prev_max bigint;
  v_count integer := 0;
  v_serial integer := 0;
  v_invoice record;
BEGIN
  v_prev_max := public.max_invoice_serial(p_year);

  FOR v_invoice IN
    SELECT i.id, i.document_number, i.created_at
    FROM public.invoices i
    WHERE i.document_number ~ ('^INV-' || p_year::text || '-\d+$')
      AND coalesce(i.status, 'draft') <> 'void'
    ORDER BY i.created_at ASC, i.id ASC
  LOOP
    v_serial := v_serial + 1;
    IF NOT p_dry_run THEN
      UPDATE public.invoices
      SET document_number = v_prefix || '-' || v_serial::text
      WHERE id = v_invoice.id
        AND document_number IS DISTINCT FROM (v_prefix || '-' || v_serial::text);
      IF FOUND THEN
        v_count := v_count + 1;
      END IF;
    ELSE
      v_count := v_count + 1;
    END IF;
  END LOOP;

  year := p_year;
  renumbered := v_count;
  previous_max_serial := v_prev_max;
  new_max_serial := GREATEST(v_serial, 0);
  next_serial := GREATEST(v_serial, 0) + 1;
  applied := false;

  IF NOT p_dry_run THEN
    INSERT INTO public.document_sequences (prefix, last_value)
    VALUES (v_prefix, GREATEST(v_serial, 0))
    ON CONFLICT (prefix) DO UPDATE
      SET last_value = EXCLUDED.last_value,
          updated_at = timezone('utc', now());
    applied := true;
  END IF;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.repair_invoice_sequence_for_year(integer, boolean) IS
  'Compact surviving INV-YYYY invoices to serials 1..N and reseed document_sequences.';

-- One-time repair for existing environments (idempotent).
SELECT * FROM public.repair_invoice_sequence_for_year(
  EXTRACT(YEAR FROM timezone('utc', now()))::integer,
  false
);
