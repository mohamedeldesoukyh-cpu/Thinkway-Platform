-- Brand owns currency. Campaign headers must sync from brand (not keep a stale
-- default such as EGP when the brand is USD).

CREATE OR REPLACE FUNCTION public.sync_campaign_header_from_brand()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_brand public.brands%ROWTYPE;
  v_client_agency public.agency_or_direct;
BEGIN
  IF NEW.brand_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_brand FROM public.brands WHERE id = NEW.brand_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brand % not found for campaign header sync', NEW.brand_id;
  END IF;

  SELECT c.agency_or_direct INTO v_client_agency
  FROM public.clients c
  WHERE c.id = v_brand.client_id;

  NEW.client_id := v_brand.client_id;

  IF TG_OP = 'INSERT' OR NEW.brand_id IS DISTINCT FROM OLD.brand_id THEN
    NEW.group_id := v_brand.group_id;
  END IF;

  -- Currency SSOT = brand (prefer brand whenever present).
  NEW.currency_code := COALESCE(
    NULLIF(BTRIM(v_brand.currency_code), ''),
    NEW.currency_code
  );
  NEW.vr_rate_id := COALESCE(NEW.vr_rate_id, v_brand.vr_rate_id);
  NEW.agency_or_direct := COALESCE(NEW.agency_or_direct, v_client_agency);
  NEW.category_id := COALESCE(NEW.category_id, v_brand.category_id);
  NEW.subcategory_id := COALESCE(NEW.subcategory_id, v_brand.subcategory_id);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_campaign_header_from_brand() IS
  'Copies commercial defaults from brand (currency SSOT) + agency_or_direct from legal entity (clients).';
