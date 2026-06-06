-- Repair function must release INV-YYYY-N slots held by void invoices before renumbering.
-- Void rows keep historical IDs but cannot block active serial compaction (unique constraint).

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
    -- Archive void invoice numbers so active rows can compact to 1..N.
    UPDATE public.invoices i
    SET
      document_number = v_prefix || '-void-' || replace(i.id::text, '-', ''),
      updated_at = timezone('utc', now())
    WHERE coalesce(i.status, 'draft') = 'void'
      AND i.document_number ~ ('^' || v_prefix || '-\d+$');

    UPDATE public.finance_documents fd
    SET
      document_number = v_prefix || '-void-' || replace(fd.source_id::text, '-', ''),
      updated_at = timezone('utc', now())
    WHERE fd.source_table = 'invoices'
      AND fd.document_number ~ ('^' || v_prefix || '-\d+$')
      AND EXISTS (
        SELECT 1
        FROM public.invoices i
        WHERE i.id = fd.source_id
          AND coalesce(i.status, 'draft') = 'void'
      );

    FOR v_invoice IN
      SELECT i.id, i.document_number, i.created_at
      FROM public.invoices i
      WHERE i.document_number ~ ('^' || v_prefix || '-\d+$')
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
      p_dry_run AND i.document_number ~ ('^' || v_prefix || '-\d+$')
      OR NOT p_dry_run AND i.document_number ~ ('^' || v_prefix || '-renum-[a-f0-9]+$')
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
  'Two-phase INV-YYYY renumber (1..N). Archives void serials first, syncs finance_documents, reseeds document_sequences.';
