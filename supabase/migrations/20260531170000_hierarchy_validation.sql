-- Enterprise hierarchy validation hardening
-- Normalized uniqueness, agency_or_direct on legal entities, brand constraints

-- -----------------------------------------------------------------------------
-- Normalization helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_entity_name(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(regexp_replace(trim(both from COALESCE(raw, '')), '\s+', ' ', 'g'));
$$;

-- -----------------------------------------------------------------------------
-- name_normalized columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS name_normalized text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS name_normalized text;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS name_normalized text;

UPDATE public.groups
SET name_normalized = public.normalize_entity_name(name)
WHERE name_normalized IS NULL OR name_normalized <> public.normalize_entity_name(name);

UPDATE public.clients
SET name_normalized = public.normalize_entity_name(name)
WHERE name_normalized IS NULL OR name_normalized <> public.normalize_entity_name(name);

UPDATE public.brands
SET name_normalized = public.normalize_entity_name(name)
WHERE name_normalized IS NULL OR name_normalized <> public.normalize_entity_name(name);

CREATE OR REPLACE FUNCTION public.sync_entity_name_normalized()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name_normalized := public.normalize_entity_name(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_groups_name_normalized ON public.groups;
CREATE TRIGGER sync_groups_name_normalized
  BEFORE INSERT OR UPDATE OF name ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.sync_entity_name_normalized();

DROP TRIGGER IF EXISTS sync_clients_name_normalized ON public.clients;
CREATE TRIGGER sync_clients_name_normalized
  BEFORE INSERT OR UPDATE OF name ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.sync_entity_name_normalized();

DROP TRIGGER IF EXISTS sync_brands_name_normalized ON public.brands;
CREATE TRIGGER sync_brands_name_normalized
  BEFORE INSERT OR UPDATE OF name ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.sync_entity_name_normalized();

-- -----------------------------------------------------------------------------
-- Move agency_or_direct from brands → clients (source of truth: legal entity)
-- -----------------------------------------------------------------------------
UPDATE public.clients c
SET agency_or_direct = COALESCE(
  c.agency_or_direct,
  (
    SELECT b.agency_or_direct
    FROM public.brands b
    WHERE b.client_id = c.id
      AND b.agency_or_direct IS NOT NULL
    ORDER BY b.created_at
    LIMIT 1
  )
)
WHERE c.agency_or_direct IS NULL;

-- -----------------------------------------------------------------------------
-- Unique constraints (normalized, race-safe at DB level)
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public.groups_name_normalized_unique;
CREATE UNIQUE INDEX groups_name_normalized_unique
  ON public.groups (name_normalized);

DROP INDEX IF EXISTS public.clients_name_relationship_unique;
CREATE UNIQUE INDEX clients_name_relationship_unique
  ON public.clients (name_normalized, agency_or_direct)
  WHERE agency_or_direct IS NOT NULL AND status <> 'archived';

ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS brands_client_name_unique;
DROP INDEX IF EXISTS public.brands_client_name_normalized_unique;
CREATE UNIQUE INDEX brands_client_name_normalized_unique
  ON public.brands (client_id, name_normalized)
  WHERE status <> 'archived';

-- -----------------------------------------------------------------------------
-- Campaign header sync: agency_or_direct from client, not brand
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_campaign_header_from_brand()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_brand public.brands%ROWTYPE;
  v_client_agency public.agency_or_direct;
BEGIN
  SELECT * INTO v_brand FROM public.brands WHERE id = NEW.brand_id;

  SELECT c.agency_or_direct INTO v_client_agency
  FROM public.clients c
  WHERE c.id = v_brand.client_id;

  NEW.client_id := v_brand.client_id;
  NEW.group_id := v_brand.group_id;
  NEW.currency_code := COALESCE(NEW.currency_code, v_brand.currency_code);
  NEW.vr_rate_id := COALESCE(NEW.vr_rate_id, v_brand.vr_rate_id);
  NEW.agency_or_direct := COALESCE(NEW.agency_or_direct, v_client_agency);
  NEW.category_id := COALESCE(NEW.category_id, v_brand.category_id);
  NEW.subcategory_id := COALESCE(NEW.subcategory_id, v_brand.subcategory_id);

  RETURN NEW;
END;
$$;

-- Remove agency_or_direct from brands (architecturally belongs on legal entity)
ALTER TABLE public.brands DROP COLUMN IF EXISTS agency_or_direct;
