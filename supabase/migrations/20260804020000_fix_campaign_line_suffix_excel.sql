-- STAB-040: campaign line suffixes after Z must continue AA, AB, …
-- Previous: chr(65 + index) overflowed into punctuation (\, ], ^, …).

CREATE OR REPLACE FUNCTION public.campaign_line_suffix(p_zero_based_index integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n integer := p_zero_based_index;
  result text := '';
BEGIN
  IF n IS NULL OR n < 0 THEN
    RAISE EXCEPTION 'campaign_line_suffix index must be >= 0';
  END IF;

  -- Excel-style 0-based → A, B, … Z, AA, AB, …
  n := n + 1;
  WHILE n > 0 LOOP
    n := n - 1;
    result := chr(65 + (n % 26)) || result;
    n := n / 26;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_campaign_line_document_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_header_number text;
  v_line_index integer;
  v_suffix text;
BEGIN
  IF NEW.document_number IS NULL OR btrim(NEW.document_number) = '' THEN
    SELECT document_number INTO v_header_number
    FROM public.campaign_headers
    WHERE id = NEW.campaign_header_id;

    SELECT COUNT(*) INTO v_line_index
    FROM public.campaign_lines
    WHERE campaign_header_id = NEW.campaign_header_id;

    v_suffix := public.campaign_line_suffix(v_line_index);
    NEW.document_number := v_header_number || '-' || v_suffix;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.campaign_line_suffix(integer) IS
  'STAB-040: Excel-style line suffix A…Z, AA… from zero-based index.';
