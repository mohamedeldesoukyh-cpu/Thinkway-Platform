-- Full invoice sequence repair: two-phase renumber avoids UNIQUE collisions,
-- syncs finance_documents.document_number, preserves invoice IDs and links.

-- Return type expanded vs 20260612010000 — must drop before recreate (42P13).
DROP FUNCTION IF EXISTS public.repair_invoice_sequence_for_year(integer, boolean);

CREATE OR REPLACE FUNCTION public.repair_invoice_sequence_for_year(
  p_year integer,
  p_dry_run boolean DEFAULT true
)
RETURNS TABLE (
  year integer,
  invoice_id uuid,
  old_document_number text,
  new_document_number text,
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
  v_old_number text;
  v_new_number text;
  v_temp_number text;
BEGIN
  v_prev_max := public.max_invoice_serial(p_year);

  IF NOT p_dry_run THEN
    FOR v_invoice IN
      SELECT i.id, i.document_number, i.created_at
      FROM public.invoices i
      WHERE i.document_number ~ ('^INV-' || p_year::text || '-\d+$')
        AND coalesce(i.status, 'draft') <> 'void'
      ORDER BY i.created_at ASC, i.id ASC
    LOOP
      v_temp_number := v_prefix || '-renum-' || replace(v_invoice.id::text, '-', '');
      UPDATE public.invoices
      SET document_number = v_temp_number
      WHERE id = v_invoice.id;

      UPDATE public.finance_documents fd
      SET document_number = v_temp_number,
          updated_at = timezone('utc', now())
      WHERE fd.source_table = 'invoices'
        AND fd.source_id = v_invoice.id;
    END LOOP;
  END IF;

  FOR v_invoice IN
    SELECT i.id, i.document_number, i.created_at
    FROM public.invoices i
    WHERE (
      p_dry_run AND i.document_number ~ ('^INV-' || p_year::text || '-\d+$')
      OR NOT p_dry_run AND i.document_number ~ ('^INV-' || p_year::text || '-renum-[a-f0-9]+$')
    )
      AND coalesce(i.status, 'draft') <> 'void'
    ORDER BY i.created_at ASC, i.id ASC
  LOOP
    v_serial := v_serial + 1;
    v_old_number := v_invoice.document_number;
    v_new_number := v_prefix || '-' || v_serial::text;

    IF NOT p_dry_run THEN
      UPDATE public.invoices
      SET document_number = v_new_number
      WHERE id = v_invoice.id;

      UPDATE public.finance_documents fd
      SET document_number = v_new_number,
          updated_at = timezone('utc', now())
      WHERE fd.source_table = 'invoices'
        AND fd.source_id = v_invoice.id;

      v_count := v_count + 1;
    END IF;

    year := p_year;
    invoice_id := v_invoice.id;
    old_document_number := v_old_number;
    new_document_number := v_new_number;
    renumbered := 1;
    previous_max_serial := v_prev_max;
    new_max_serial := v_serial;
    next_serial := v_serial + 1;
    applied := NOT p_dry_run;
    RETURN NEXT;
  END LOOP;

  IF v_serial = 0 THEN
    year := p_year;
    invoice_id := NULL;
    old_document_number := NULL;
    new_document_number := NULL;
    renumbered := 0;
    previous_max_serial := v_prev_max;
    new_max_serial := 0;
    next_serial := 1;
    applied := false;
    RETURN NEXT;
  END IF;

  IF NOT p_dry_run THEN
    INSERT INTO public.document_sequences (prefix, last_value)
    VALUES (v_prefix, GREATEST(v_serial, 0))
    ON CONFLICT (prefix) DO UPDATE
      SET last_value = EXCLUDED.last_value,
          updated_at = timezone('utc', now());
  END IF;
END;
$$;

COMMENT ON FUNCTION public.repair_invoice_sequence_for_year(integer, boolean) IS
  'Two-phase INV-YYYY renumber (1..N), sync finance_documents, reseed document_sequences.';

-- Apply full repair for current UTC year (idempotent two-phase renumber).
SELECT * FROM public.repair_invoice_sequence_for_year(
  EXTRACT(YEAR FROM timezone('utc', now()))::integer,
  false
);
