-- Campaign headers may exist without a holding group (independent clients/brands).
-- Aligns with optional group_id on clients and brands (client onboarding hardening).

ALTER TABLE public.campaign_headers
  ALTER COLUMN group_id DROP NOT NULL;

COMMENT ON COLUMN public.campaign_headers.group_id IS
  'Optional holding group. NULL for independent advertisers not linked to a group.';

-- Sync group from brand on insert or brand change; preserve explicit group_id updates otherwise.
CREATE OR REPLACE FUNCTION public.sync_campaign_header_from_brand()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_brand public.brands%ROWTYPE;
BEGIN
  SELECT * INTO v_brand FROM public.brands WHERE id = NEW.brand_id;

  NEW.client_id := v_brand.client_id;

  IF TG_OP = 'INSERT' OR NEW.brand_id IS DISTINCT FROM OLD.brand_id THEN
    NEW.group_id := v_brand.group_id;
  END IF;

  NEW.currency_code := COALESCE(NEW.currency_code, v_brand.currency_code);
  NEW.vr_rate_id := COALESCE(NEW.vr_rate_id, v_brand.vr_rate_id);
  NEW.agency_or_direct := COALESCE(NEW.agency_or_direct, v_brand.agency_or_direct);
  NEW.category_id := COALESCE(NEW.category_id, v_brand.category_id);
  NEW.subcategory_id := COALESCE(NEW.subcategory_id, v_brand.subcategory_id);

  RETURN NEW;
END;
$$;
