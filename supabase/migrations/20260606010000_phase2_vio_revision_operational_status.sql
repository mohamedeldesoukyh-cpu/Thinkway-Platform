-- Phase 2: VIO revision chain + extended line operational_status

-- -----------------------------------------------------------------------------
-- Operational status enum extensions
-- -----------------------------------------------------------------------------
ALTER TYPE public.campaign_line_operational_status ADD VALUE IF NOT EXISTS 'moved_to_billing';
ALTER TYPE public.campaign_line_operational_status ADD VALUE IF NOT EXISTS 'closed';

-- -----------------------------------------------------------------------------
-- Vendor IO revision chain (Option A: new row per revision)
-- -----------------------------------------------------------------------------
ALTER TABLE public.vendor_ios
  ADD COLUMN IF NOT EXISTS is_superseded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS replaces_vendor_io_id uuid REFERENCES public.vendor_ios (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS root_vendor_io_id uuid REFERENCES public.vendor_ios (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vendor_ios_root_vendor_io_id_idx
  ON public.vendor_ios (root_vendor_io_id);

CREATE INDEX IF NOT EXISTS vendor_ios_active_campaign_influencer_idx
  ON public.vendor_ios (campaign_header_id, influencer_id)
  WHERE is_superseded = false;

-- -----------------------------------------------------------------------------
-- Dedupe legacy rows: Phase 1 allowed multiple vendor_ios per influencer/campaign.
-- Keep the newest row active; supersede older duplicates before unique index.
-- -----------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY campaign_header_id, influencer_id
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.vendor_ios
  WHERE is_superseded = false
)
UPDATE public.vendor_ios v
SET is_superseded = true
FROM ranked r
WHERE v.id = r.id
  AND r.rn > 1;

-- Point assignment lines at the surviving active VIO per campaign + influencer
UPDATE public.campaign_lines cl
SET vendor_io_id = active.id
FROM public.vendor_ios superseded
JOIN LATERAL (
  SELECT v.id
  FROM public.vendor_ios v
  WHERE v.campaign_header_id = superseded.campaign_header_id
    AND v.influencer_id = superseded.influencer_id
    AND v.is_superseded = false
  ORDER BY v.created_at DESC NULLS LAST, v.id DESC
  LIMIT 1
) active ON true
WHERE cl.vendor_io_id = superseded.id
  AND superseded.is_superseded = true;

-- Re-link vendor_io_lines to active VIO where possible
UPDATE public.vendor_io_lines vil
SET vendor_io_id = active.id
FROM public.vendor_ios superseded
JOIN LATERAL (
  SELECT v.id
  FROM public.vendor_ios v
  WHERE v.campaign_header_id = superseded.campaign_header_id
    AND v.influencer_id = superseded.influencer_id
    AND v.is_superseded = false
  ORDER BY v.created_at DESC NULLS LAST, v.id DESC
  LIMIT 1
) active ON true
WHERE vil.vendor_io_id = superseded.id
  AND superseded.is_superseded = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.vendor_io_lines existing
    WHERE existing.campaign_line_id = vil.campaign_line_id
      AND existing.vendor_io_id = active.id
  );

-- Drop orphan links on superseded IOs when the line already points at the active IO
DELETE FROM public.vendor_io_lines vil
USING public.vendor_ios v
WHERE vil.vendor_io_id = v.id
  AND v.is_superseded = true;

-- Only one active (non-superseded) IO per influencer per campaign
CREATE UNIQUE INDEX IF NOT EXISTS vendor_ios_active_influencer_campaign_unique
  ON public.vendor_ios (campaign_header_id, influencer_id)
  WHERE is_superseded = false;

-- Revisions reuse base serial; skip sequence when document_number preset
CREATE OR REPLACE FUNCTION public.assign_vendor_io_document_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(timezone('utc', now()), 'YYYY');
  v_prefix text := 'VIO-' || v_year;
  v_next bigint;
  v_base text;
BEGIN
  IF NEW.document_number IS NOT NULL AND btrim(NEW.document_number) <> '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.document_sequences AS ds (prefix, last_value)
  VALUES (v_prefix, 1)
  ON CONFLICT (prefix) DO UPDATE
    SET last_value = ds.last_value + 1
  RETURNING last_value INTO v_next;

  v_base := v_prefix || '-' || lpad(v_next::text, 4, '0');
  IF COALESCE(NEW.revision_number, 0) > 0 THEN
    NEW.document_number := v_base || '/' || NEW.revision_number::text;
  ELSE
    NEW.document_number := v_base;
  END IF;

  IF NEW.root_vendor_io_id IS NULL THEN
    NEW.root_vendor_io_id := NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill root_vendor_io_id for existing rows
UPDATE public.vendor_ios
SET root_vendor_io_id = id
WHERE root_vendor_io_id IS NULL;
