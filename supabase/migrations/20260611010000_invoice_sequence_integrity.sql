-- Invoice serial integrity: align INV-YYYY sequences with surviving invoices.
-- Prevents gaps from deleted draft invoices and stale document_sequences rows.

CREATE OR REPLACE FUNCTION public.max_invoice_serial(p_year integer)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    max(
      (regexp_match(i.document_number, '^INV-' || p_year::text || '-(\d+)$'))[1]::bigint
    ),
    0::bigint
  )
  FROM public.invoices i
  WHERE i.document_number ~ ('^INV-' || p_year::text || '-\d+$');
$$;

COMMENT ON FUNCTION public.max_invoice_serial(integer) IS
  'Highest INV-YYYY-NNNNN serial among existing invoices for the year.';

CREATE OR REPLACE FUNCTION public.reseed_invoice_document_sequences(
  p_year integer DEFAULT NULL,
  p_dry_run boolean DEFAULT true
)
RETURNS TABLE (
  year integer,
  prefix text,
  previous_last_value bigint,
  new_last_value bigint,
  max_existing_serial bigint,
  next_serial bigint,
  surviving_invoices bigint,
  applied boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer;
  v_prefix text;
  v_max bigint;
  v_prev bigint;
  v_survivors bigint;
BEGIN
  FOR v_year IN
    SELECT DISTINCT y
    FROM (
      SELECT (regexp_match(ds.prefix, '^INV-(\d{4})$'))[1]::integer AS y
      FROM public.document_sequences ds
      WHERE ds.prefix ~ '^INV-\d{4}$'
      UNION
      SELECT (regexp_match(i.document_number, '^INV-(\d{4})-\d+$'))[1]::integer AS y
      FROM public.invoices i
      WHERE i.document_number ~ '^INV-\d{4}-\d+$'
    ) years
    WHERE y IS NOT NULL
      AND (p_year IS NULL OR y = p_year)
    ORDER BY y
  LOOP
    v_prefix := 'INV-' || v_year::text;
    v_max := public.max_invoice_serial(v_year);

    SELECT ds.last_value INTO v_prev
    FROM public.document_sequences ds
    WHERE ds.prefix = v_prefix;

    v_prev := coalesce(v_prev, 0);

    SELECT count(*) INTO v_survivors
    FROM public.invoices i
    WHERE i.document_number ~ ('^INV-' || v_year::text || '-\d+$');

    year := v_year;
    prefix := v_prefix;
    previous_last_value := v_prev;
    new_last_value := v_max;
    max_existing_serial := v_max;
    next_serial := v_max + 1;
    surviving_invoices := v_survivors;
    applied := false;

    IF NOT p_dry_run THEN
      INSERT INTO public.document_sequences (prefix, last_value)
      VALUES (v_prefix, v_max)
      ON CONFLICT (prefix) DO UPDATE
        SET last_value = EXCLUDED.last_value,
            updated_at = timezone('utc', now());
      applied := true;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.reseed_invoice_document_sequences(integer, boolean) IS
  'Align INV-YYYY document_sequences with max surviving invoice serial. Next insert = MAX+1.';

-- Trigger: never assign a serial below max existing invoice for the year.
CREATE OR REPLACE FUNCTION public.assign_invoice_year_document_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(timezone('utc', now()), 'YYYY');
  v_prefix text := 'INV-' || v_year;
  v_year_int integer := v_year::integer;
  v_max_existing bigint;
  v_next bigint;
BEGIN
  IF NEW.document_number IS NULL OR btrim(NEW.document_number) = '' THEN
    v_max_existing := public.max_invoice_serial(v_year_int);

    INSERT INTO public.document_sequences AS ds (prefix, last_value)
    VALUES (v_prefix, v_max_existing)
    ON CONFLICT (prefix) DO UPDATE
      SET last_value = GREATEST(ds.last_value, EXCLUDED.last_value, v_max_existing)
    RETURNING last_value INTO v_next;

    v_next := GREATEST(coalesce(v_next, 0), v_max_existing) + 1;

    UPDATE public.document_sequences
    SET last_value = v_next,
        updated_at = timezone('utc', now())
    WHERE prefix = v_prefix;

    NEW.document_number := v_prefix || '-' || lpad(v_next::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- One-time repair for existing environments (idempotent).
SELECT * FROM public.reseed_invoice_document_sequences(NULL, false);
