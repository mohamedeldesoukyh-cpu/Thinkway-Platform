-- generate_quotation_serial must write document_sequences as the function owner.
-- That table is FORCE RLS + deny-all for authenticated; next_document_number()
-- is already SECURITY DEFINER. Without this, shortlist → quotation fails with:
--   new row violates row-level security policy for table "document_sequences"

CREATE OR REPLACE FUNCTION public.generate_quotation_serial(
  p_at timestamptz DEFAULT timezone('utc', now())
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer;
  v_prefix text;
  v_max bigint;
  v_serial text;
  v_attempts integer := 0;
BEGIN
  v_year := extract(year from timezone('utc', p_at))::integer;
  v_prefix := 'QT-' || v_year::text;
  v_max := public.max_quotation_base_serial(v_year);

  INSERT INTO public.document_sequences AS ds (prefix, last_value)
  VALUES (v_prefix, v_max)
  ON CONFLICT (prefix) DO UPDATE
    SET last_value = GREATEST(ds.last_value, EXCLUDED.last_value),
        updated_at = timezone('utc', now());

  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 50 THEN
      RAISE EXCEPTION 'generate_quotation_serial: could not allocate unused serial for %', v_prefix;
    END IF;

    v_serial := public.next_document_number(v_prefix, 4);
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.quotations q
      WHERE q.serial_number = v_serial
    );
  END LOOP;

  RETURN v_serial;
END;
$$;

COMMENT ON FUNCTION public.generate_quotation_serial(timestamptz) IS
  'Generates the next unused QT-YYYY-NNNN quotation serial. SECURITY DEFINER so document_sequences writes bypass deny-all RLS.';

REVOKE ALL ON FUNCTION public.generate_quotation_serial(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_quotation_serial(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_quotation_serial(timestamptz) TO service_role;
