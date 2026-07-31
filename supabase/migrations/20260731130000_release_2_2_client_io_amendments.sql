-- =============================================================================
-- Release 2.2.B — Client IO append-only amendments (Development-first)
-- Mirror Vendor IO revision chain with CIO-YYYY-NNNN/A1 numbering.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Amendment chain columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.client_ios
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_superseded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replaces_client_io_id uuid
    REFERENCES public.client_ios (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS root_client_io_id uuid
    REFERENCES public.client_ios (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.client_ios.revision_number IS
  'Release 2.2: 0 = original CIO-YYYY-NNNN; 1+ = amendment CIO-YYYY-NNNN/A{n}';
COMMENT ON COLUMN public.client_ios.is_superseded IS
  'Release 2.2: false = current tip for the campaign; prior versions remain immutable.';
COMMENT ON COLUMN public.client_ios.root_client_io_id IS
  'Release 2.2: amendment chain root (self for originals).';
COMMENT ON COLUMN public.client_ios.replaces_client_io_id IS
  'Release 2.2: immediate prior tip superseded by this amendment.';

-- Backfill roots for existing rows
UPDATE public.client_ios
SET root_client_io_id = id
WHERE root_client_io_id IS NULL;

-- Drop one-row-per-campaign uniqueness; replace with one active tip per campaign
ALTER TABLE public.client_ios
  DROP CONSTRAINT IF EXISTS client_ios_campaign_header_id_key;

DROP INDEX IF EXISTS client_ios_campaign_header_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS client_ios_active_campaign_unique
  ON public.client_ios (campaign_header_id)
  WHERE is_superseded = false;

CREATE INDEX IF NOT EXISTS client_ios_root_client_io_id_idx
  ON public.client_ios (root_client_io_id);

CREATE INDEX IF NOT EXISTS client_ios_campaign_header_id_idx
  ON public.client_ios (campaign_header_id);

-- -----------------------------------------------------------------------------
-- Document number trigger: keep preset amendment numbers (…/A1)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_client_io_document_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(timezone('utc', now()), 'YYYY');
  v_prefix text := 'CIO-' || v_year;
  v_next bigint;
BEGIN
  IF NEW.document_number IS NULL OR btrim(NEW.document_number) = '' THEN
    INSERT INTO public.document_sequences AS ds (prefix, last_value)
    VALUES (v_prefix, 1)
    ON CONFLICT (prefix) DO UPDATE
      SET last_value = ds.last_value + 1
    RETURNING last_value INTO v_next;

    NEW.document_number := v_prefix || '-' || lpad(v_next::text, 4, '0');
  END IF;

  IF NEW.root_client_io_id IS NULL THEN
    NEW.root_client_io_id := NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- After INSERT, root may still be null when id was not known at BEFORE INSERT.
-- Heal with AFTER INSERT trigger for brand-new roots.
CREATE OR REPLACE FUNCTION public.client_ios_set_root_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.root_client_io_id IS NULL THEN
    UPDATE public.client_ios
    SET root_client_io_id = NEW.id
    WHERE id = NEW.id
      AND root_client_io_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_ios_set_root_on_insert ON public.client_ios;
CREATE TRIGGER client_ios_set_root_on_insert
  AFTER INSERT ON public.client_ios
  FOR EACH ROW
  EXECUTE FUNCTION public.client_ios_set_root_on_insert();

-- -----------------------------------------------------------------------------
-- ensure_client_io_for_campaign — return active tip only
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_client_io_for_campaign(
  p_campaign_header_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_client_id uuid;
  v_client_terms text;
BEGIN
  SELECT id INTO v_existing_id
  FROM public.client_ios
  WHERE campaign_header_id = p_campaign_header_id
    AND is_superseded = false
  ORDER BY revision_number DESC, created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  SELECT ch.client_id, c.client_io_terms_text
  INTO v_client_id, v_client_terms
  FROM public.campaign_headers ch
  JOIN public.clients c ON c.id = ch.client_id
  WHERE ch.id = p_campaign_header_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Campaign header not found for IO creation.';
  END IF;

  INSERT INTO public.client_ios (
    campaign_header_id,
    client_id,
    status,
    terms_text,
    revision_number,
    is_superseded,
    created_by,
    updated_by
  )
  VALUES (
    p_campaign_header_id,
    v_client_id,
    'draft',
    NULLIF(trim(v_client_terms), ''),
    0,
    false,
    p_actor_id,
    p_actor_id
  )
  RETURNING id INTO v_existing_id;

  UPDATE public.client_ios
  SET root_client_io_id = v_existing_id
  WHERE id = v_existing_id
    AND root_client_io_id IS NULL;

  RETURN v_existing_id;
END;
$$;
