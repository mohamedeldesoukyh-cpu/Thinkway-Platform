-- Controlled-reset helper: realign document_sequences with surviving campaign_headers.
-- USE ONLY during bootstrap purge / rebuild — not for routine production deletes.

CREATE OR REPLACE FUNCTION public.max_campaign_header_serial(p_year integer)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    max(
      (regexp_match(ch.document_number, '^TW-' || p_year::text || '-(\d+)$'))[1]::bigint
    ),
    0::bigint
  )
  FROM public.campaign_headers ch
  WHERE ch.document_number ~ ('^TW-' || p_year::text || '-\d+$');
$$;

COMMENT ON FUNCTION public.max_campaign_header_serial(integer) IS
  'Highest TW-YYYY-NNNN serial among existing campaign_headers for the year (numeric segment only).';

/**
 * Reseed TW-YYYY document_sequences.last_value to match MAX existing header serial.
 * Next insert via next_document_number() will therefore be MAX+1.
 *
 * p_dry_run=true  → report only
 * p_dry_run=false → apply update
 */
CREATE OR REPLACE FUNCTION public.reseed_thinkway_campaign_sequence(
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
  surviving_campaigns bigint,
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
      SELECT (regexp_match(ds.prefix, '^TW-(\d{4})$'))[1]::integer AS y
      FROM public.document_sequences ds
      WHERE ds.prefix ~ '^TW-\d{4}$'
      UNION
      SELECT (regexp_match(ch.document_number, '^TW-(\d{4})-\d+$'))[1]::integer AS y
      FROM public.campaign_headers ch
      WHERE ch.document_number ~ '^TW-\d{4}-\d+$'
    ) years
    WHERE y IS NOT NULL
      AND (p_year IS NULL OR y = p_year)
    ORDER BY y
  LOOP
    v_prefix := 'TW-' || v_year::text;
    v_max := public.max_campaign_header_serial(v_year);

    SELECT ds.last_value INTO v_prev
    FROM public.document_sequences ds
    WHERE ds.prefix = v_prefix;

    v_prev := coalesce(v_prev, 0);

    SELECT count(*) INTO v_survivors
    FROM public.campaign_headers ch
    WHERE ch.document_number ~ ('^TW-' || v_year::text || '-\d+$');

    year := v_year;
    prefix := v_prefix;
    previous_last_value := v_prev;
    new_last_value := v_max;
    max_existing_serial := v_max;
    next_serial := v_max + 1;
    surviving_campaigns := v_survivors;
    applied := false;

    IF NOT p_dry_run AND v_prev IS DISTINCT FROM v_max THEN
      INSERT INTO public.document_sequences (prefix, last_value)
      VALUES (v_prefix, v_max)
      ON CONFLICT (prefix) DO UPDATE
        SET last_value = EXCLUDED.last_value,
            updated_at = timezone('utc', now());
      applied := true;
    ELSIF NOT p_dry_run AND v_prev = v_max THEN
      applied := true;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.reseed_thinkway_campaign_sequence(integer, boolean) IS
  'Controlled rebuild only: align TW-YYYY document_sequences with max surviving campaign header serial.';
