-- =============================================================================
-- Enterprise hierarchy: Groups → Clients (legal) → Brands
-- Campaign headers/lines, agencies, admin master data
-- Idempotent — safe to re-run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Master data (admin-managed)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.md_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.md_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.md_categories (id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT md_subcategories_category_code_unique UNIQUE (category_id, code)
);

CREATE TABLE IF NOT EXISTS public.md_currencies (
  code char(3) PRIMARY KEY,
  name text NOT NULL,
  symbol text,
  decimal_places smallint NOT NULL DEFAULT 2,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.md_countries (
  code char(2) PRIMARY KEY,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.md_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.md_report_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.md_payment_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  days_due integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.md_vr_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  rate_percent numeric(6, 3) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT md_vr_rates_rate_non_negative CHECK (rate_percent >= 0)
);

-- Seed master data (idempotent)
INSERT INTO public.md_currencies (code, name, symbol) VALUES
  ('USD', 'US Dollar', '$'),
  ('AED', 'UAE Dirham', 'د.إ'),
  ('SAR', 'Saudi Riyal', '﷼'),
  ('EGP', 'Egyptian Pound', 'E£'),
  ('EUR', 'Euro', '€')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, symbol = EXCLUDED.symbol;

INSERT INTO public.md_countries (code, name) VALUES
  ('AE', 'United Arab Emirates'),
  ('SA', 'Saudi Arabia'),
  ('EG', 'Egypt'),
  ('US', 'United States'),
  ('GB', 'United Kingdom')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.md_payment_terms (code, name, days_due) VALUES
  ('due_on_receipt', 'Due on receipt', 0),
  ('net_15', 'Net 15', 15),
  ('net_30', 'Net 30', 30),
  ('net_45', 'Net 45', 45),
  ('net_60', 'Net 60', 60),
  ('net_90', 'Net 90', 90),
  ('custom', 'Custom', NULL)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, days_due = EXCLUDED.days_due;

INSERT INTO public.md_categories (code, name, sort_order) VALUES
  ('fmcg', 'FMCG', 1),
  ('beauty', 'Beauty', 2),
  ('automotive', 'Automotive', 3),
  ('technology', 'Technology', 4),
  ('finance', 'Finance', 5),
  ('retail', 'Retail', 6),
  ('government', 'Government', 7),
  ('entertainment', 'Entertainment', 8),
  ('other', 'Other', 99)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

INSERT INTO public.md_subcategories (category_id, code, name, sort_order)
SELECT c.id, v.code, v.name, v.sort_order
FROM public.md_categories c
JOIN (VALUES
  ('beauty', 'skincare', 'Skincare', 1),
  ('beauty', 'makeup', 'Makeup', 2),
  ('beauty', 'fragrance', 'Fragrance', 3),
  ('fmcg', 'food_beverage', 'Food & Beverage', 1),
  ('technology', 'software', 'Software', 1),
  ('retail', 'ecommerce', 'E-commerce', 1),
  ('other', 'general', 'General', 1)
) AS v(cat_code, code, name, sort_order) ON c.code = v.cat_code
ON CONFLICT (category_id, code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.md_vr_rates (code, name, rate_percent) VALUES
  ('vr_0', '0%', 0),
  ('vr_5', '5%', 5),
  ('vr_10', '10%', 10),
  ('vr_15', '15%', 15),
  ('vr_20', '20%', 20)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, rate_percent = EXCLUDED.rate_percent;

INSERT INTO public.md_teams (code, name) VALUES
  ('ops', 'Operations'),
  ('creative', 'Creative'),
  ('finance', 'Finance')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.md_report_types (code, name) VALUES
  ('campaign_summary', 'Campaign Summary'),
  ('financial', 'Financial Report'),
  ('influencer', 'Influencer Report')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- -----------------------------------------------------------------------------
-- Groups
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  name text NOT NULL,
  status public.client_status NOT NULL DEFAULT 'active',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS groups_name_idx ON public.groups (name);
CREATE INDEX IF NOT EXISTS groups_status_idx ON public.groups (status);

DROP TRIGGER IF EXISTS assign_groups_document_number ON public.groups;
CREATE TRIGGER assign_groups_document_number
  BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('GRP');

DROP TRIGGER IF EXISTS set_groups_updated_at ON public.groups;
CREATE TRIGGER set_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Clients (legal entities) — link to group
-- -----------------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS clients_group_id_idx ON public.clients (group_id);

-- -----------------------------------------------------------------------------
-- Brands (unique per client legal entity)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE RESTRICT,
  name text NOT NULL,
  status public.client_status NOT NULL DEFAULT 'active',
  category_id uuid REFERENCES public.md_categories (id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.md_subcategories (id) ON DELETE SET NULL,
  agency_or_direct public.agency_or_direct,
  vr_rate_id uuid REFERENCES public.md_vr_rates (id) ON DELETE SET NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD' REFERENCES public.md_currencies (code),
  payment_term_id uuid REFERENCES public.md_payment_terms (id) ON DELETE SET NULL,
  country_code char(2) REFERENCES public.md_countries (code),
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT brands_client_name_unique UNIQUE (client_id, name),
  CONSTRAINT brands_subcategory_matches_category CHECK (
    subcategory_id IS NULL OR category_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS brands_client_id_idx ON public.brands (client_id);
CREATE INDEX IF NOT EXISTS brands_group_id_idx ON public.brands (group_id);
CREATE INDEX IF NOT EXISTS brands_category_id_idx ON public.brands (category_id);

DROP TRIGGER IF EXISTS assign_brands_document_number ON public.brands;
CREATE TRIGGER assign_brands_document_number
  BEFORE INSERT ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('BRD');

DROP TRIGGER IF EXISTS set_brands_updated_at ON public.brands;
CREATE TRIGGER set_brands_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sync group_id from client on brand insert/update
CREATE OR REPLACE FUNCTION public.sync_brand_group_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.group_id IS NULL OR TG_OP = 'INSERT' THEN
    SELECT group_id INTO NEW.group_id FROM public.clients WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_brand_group_id_trigger ON public.brands;
CREATE TRIGGER sync_brand_group_id_trigger
  BEFORE INSERT OR UPDATE OF client_id ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.sync_brand_group_id();

-- Backfill: default group + brand per existing client
DO $$
DECLARE
  r record;
  v_group_id uuid;
  v_cat_id uuid;
  v_sub_id uuid;
  v_vr_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.groups LIMIT 1) THEN
    INSERT INTO public.groups (document_number, name, status)
    VALUES ('GRP-000001', 'Default Group', 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT id INTO v_group_id FROM public.groups ORDER BY created_at LIMIT 1;

  UPDATE public.clients SET group_id = v_group_id WHERE group_id IS NULL;

  SELECT id INTO v_cat_id FROM public.md_categories WHERE code = 'other' LIMIT 1;
  SELECT id INTO v_sub_id FROM public.md_subcategories WHERE code = 'general' LIMIT 1;
  SELECT id INTO v_vr_id FROM public.md_vr_rates WHERE code = 'vr_0' LIMIT 1;

  FOR r IN
    SELECT c.id, c.name, c.group_id, c.currency, c.client_category, c.client_subcategory,
           c.agency_or_direct, c.country
    FROM public.clients c
    WHERE NOT EXISTS (SELECT 1 FROM public.brands b WHERE b.client_id = c.id)
  LOOP
    INSERT INTO public.brands (
      document_number, client_id, group_id, name, category_id, subcategory_id,
      agency_or_direct, vr_rate_id, currency_code, country_code
    )
    VALUES (
      'BRD-MIG-' || substr(replace(r.id::text, '-', ''), 1, 12),
      r.id,
      COALESCE(r.group_id, v_group_id),
      r.name,
      v_cat_id,
      v_sub_id,
      r.agency_or_direct,
      v_vr_id,
      COALESCE(r.currency, 'USD'),
      r.country
    )
    ON CONFLICT (client_id, name) DO NOTHING;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Agencies
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  email citext,
  phone text,
  country_code char(2) REFERENCES public.md_countries (code),
  status public.influencer_status NOT NULL DEFAULT 'active',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS agencies_name_idx ON public.agencies (name);
CREATE INDEX IF NOT EXISTS agencies_status_idx ON public.agencies (status);

ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS influencers_agency_id_idx ON public.influencers (agency_id);

DROP TRIGGER IF EXISTS assign_agencies_document_number ON public.agencies;
CREATE TRIGGER assign_agencies_document_number
  BEFORE INSERT ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.assign_document_number('AGY');

DROP TRIGGER IF EXISTS set_agencies_updated_at ON public.agencies;
CREATE TRIGGER set_agencies_updated_at
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migrate free-text agency names to agencies table
DO $$
DECLARE
  r record;
  v_agency_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT COALESCE(NULLIF(btrim(management_agency), ''), NULLIF(btrim(legal_name), '')) AS agency_name
    FROM public.influencers
    WHERE agency_id IS NULL
      AND (management_agency IS NOT NULL OR legal_name IS NOT NULL)
      AND COALESCE(NULLIF(btrim(management_agency), ''), NULLIF(btrim(legal_name), '')) IS NOT NULL
  LOOP
    INSERT INTO public.agencies (document_number, name, status)
    VALUES ('AGY-MIG-' || substr(md5(r.agency_name), 1, 12), r.agency_name, 'active')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_agency_id;

    IF v_agency_id IS NULL THEN
      SELECT id INTO v_agency_id FROM public.agencies WHERE name = r.agency_name LIMIT 1;
    END IF;

    UPDATE public.influencers
    SET agency_id = v_agency_id
    WHERE agency_id IS NULL
      AND (management_agency = r.agency_name OR legal_name = r.agency_name);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Campaign document numbering (TW-YYYY-NNNN / TW-YYYY-NNNN-A)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_campaign_header_document_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.document_number IS NULL OR btrim(NEW.document_number) = '' THEN
    NEW.document_number := public.next_document_number(
      'TW-' || to_char(timezone('utc', now()), 'YYYY'),
      4
    );
  END IF;
  RETURN NEW;
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

    v_suffix := chr(65 + v_line_index);
    NEW.document_number := v_header_number || '-' || v_suffix;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_campaign_line_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.fx_rate IS NULL OR NEW.fx_rate <= 0 THEN
    NEW.fx_rate := 1;
  END IF;

  NEW.profit := ROUND(COALESCE(NEW.revenue, 0) - COALESCE(NEW.cost, 0), 2);

  IF COALESCE(NEW.revenue, 0) > 0 THEN
    NEW.profit_margin := ROUND((NEW.profit / NEW.revenue) * 100, 4);
  ELSE
    NEW.profit_margin := 0;
  END IF;

  IF COALESCE(NEW.cost, 0) > 0 THEN
    NEW.markup_margin := ROUND((NEW.profit / NEW.cost) * 100, 4);
  ELSE
    NEW.markup_margin := 0;
  END IF;

  NEW.remaining_po := ROUND(COALESCE(NEW.po_amount, 0) - COALESCE(NEW.cost, 0), 2);
  NEW.revenue_base := ROUND(COALESCE(NEW.revenue, 0) / NEW.fx_rate, 2);
  NEW.cost_base := ROUND(COALESCE(NEW.cost, 0) / NEW.fx_rate, 2);
  NEW.profit_base := ROUND(NEW.revenue_base - NEW.cost_base, 2);

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Campaign headers & lines
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_headers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  brief text,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE RESTRICT,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  brand_id uuid NOT NULL REFERENCES public.brands (id) ON DELETE RESTRICT,
  team_id uuid REFERENCES public.md_teams (id) ON DELETE SET NULL,
  report_type_id uuid REFERENCES public.md_report_types (id) ON DELETE SET NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD' REFERENCES public.md_currencies (code),
  vr_rate_id uuid REFERENCES public.md_vr_rates (id) ON DELETE SET NULL,
  agency_or_direct public.agency_or_direct,
  category_id uuid REFERENCES public.md_categories (id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.md_subcategories (id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  account_manager_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT campaign_headers_date_range CHECK (
    start_date IS NULL OR end_date IS NULL OR start_date <= end_date
  )
);

CREATE INDEX IF NOT EXISTS campaign_headers_brand_id_idx ON public.campaign_headers (brand_id);
CREATE INDEX IF NOT EXISTS campaign_headers_client_id_idx ON public.campaign_headers (client_id);
CREATE INDEX IF NOT EXISTS campaign_headers_group_id_idx ON public.campaign_headers (group_id);
CREATE INDEX IF NOT EXISTS campaign_headers_status_idx ON public.campaign_headers (status);

CREATE TABLE IF NOT EXISTS public.campaign_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  platform text,
  revenue numeric(14, 2) NOT NULL DEFAULT 0,
  cost numeric(14, 2) NOT NULL DEFAULT 0,
  profit numeric(14, 2) NOT NULL DEFAULT 0,
  profit_margin numeric(8, 4) NOT NULL DEFAULT 0,
  markup_margin numeric(8, 4) NOT NULL DEFAULT 0,
  po_amount numeric(14, 2) NOT NULL DEFAULT 0,
  remaining_po numeric(14, 2) NOT NULL DEFAULT 0,
  currency_code char(3) NOT NULL DEFAULT 'USD' REFERENCES public.md_currencies (code),
  base_currency char(3) NOT NULL DEFAULT 'USD' REFERENCES public.md_currencies (code),
  fx_rate numeric(12, 6) NOT NULL DEFAULT 1,
  revenue_base numeric(14, 2) NOT NULL DEFAULT 0,
  cost_base numeric(14, 2) NOT NULL DEFAULT 0,
  profit_base numeric(14, 2) NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT campaign_lines_amounts_non_negative CHECK (
    revenue >= 0 AND cost >= 0 AND po_amount >= 0
  ),
  CONSTRAINT campaign_lines_fx_rate_positive CHECK (fx_rate > 0)
);

CREATE INDEX IF NOT EXISTS campaign_lines_header_id_idx ON public.campaign_lines (campaign_header_id);

DROP TRIGGER IF EXISTS assign_campaign_headers_document_number ON public.campaign_headers;
CREATE TRIGGER assign_campaign_headers_document_number
  BEFORE INSERT ON public.campaign_headers
  FOR EACH ROW EXECUTE FUNCTION public.assign_campaign_header_document_number();

DROP TRIGGER IF EXISTS assign_campaign_lines_document_number ON public.campaign_lines;
CREATE TRIGGER assign_campaign_lines_document_number
  BEFORE INSERT ON public.campaign_lines
  FOR EACH ROW EXECUTE FUNCTION public.assign_campaign_line_document_number();

DROP TRIGGER IF EXISTS compute_campaign_lines_financials ON public.campaign_lines;
CREATE TRIGGER compute_campaign_lines_financials
  BEFORE INSERT OR UPDATE ON public.campaign_lines
  FOR EACH ROW EXECUTE FUNCTION public.compute_campaign_line_financials();

DROP TRIGGER IF EXISTS set_campaign_headers_updated_at ON public.campaign_headers;
CREATE TRIGGER set_campaign_headers_updated_at
  BEFORE UPDATE ON public.campaign_headers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_campaign_lines_updated_at ON public.campaign_lines;
CREATE TRIGGER set_campaign_lines_updated_at
  BEFORE UPDATE ON public.campaign_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sync campaign header hierarchy from brand
CREATE OR REPLACE FUNCTION public.sync_campaign_header_from_brand()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_brand public.brands%ROWTYPE;
BEGIN
  SELECT * INTO v_brand FROM public.brands WHERE id = NEW.brand_id;

  NEW.client_id := v_brand.client_id;
  NEW.group_id := v_brand.group_id;
  NEW.currency_code := COALESCE(NEW.currency_code, v_brand.currency_code);
  NEW.vr_rate_id := COALESCE(NEW.vr_rate_id, v_brand.vr_rate_id);
  NEW.agency_or_direct := COALESCE(NEW.agency_or_direct, v_brand.agency_or_direct);
  NEW.category_id := COALESCE(NEW.category_id, v_brand.category_id);
  NEW.subcategory_id := COALESCE(NEW.subcategory_id, v_brand.subcategory_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_campaign_header_from_brand_trigger ON public.campaign_headers;
CREATE TRIGGER sync_campaign_header_from_brand_trigger
  BEFORE INSERT OR UPDATE OF brand_id ON public.campaign_headers
  FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_header_from_brand();

-- Migrate legacy campaigns → headers + lines
DO $$
DECLARE
  r record;
  v_header_id uuid;
  v_brand_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns') THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.campaign_headers LIMIT 1) THEN
    RETURN;
  END IF;

  FOR r IN SELECT * FROM public.campaigns ORDER BY created_at
  LOOP
    SELECT id INTO v_brand_id FROM public.brands WHERE client_id = r.client_id ORDER BY created_at LIMIT 1;

    IF v_brand_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.campaign_headers (
      id, document_number, name, description, brief, status,
      group_id, client_id, brand_id, currency_code,
      start_date, end_date, account_manager_id, objectives, metadata,
      created_by, created_at, updated_at
    )
    SELECT
      r.id,
      CASE WHEN r.document_number LIKE 'TW-%' THEN r.document_number
           ELSE 'TW-MIG-' || substr(replace(r.id::text, '-', ''), 1, 8) END,
      r.name, r.description, r.brief, r.status,
      c.group_id, r.client_id, v_brand_id, r.currency,
      r.start_date, r.end_date, r.account_manager_id, r.objectives, r.metadata,
      r.created_by, r.created_at, r.updated_at
    FROM public.clients c WHERE c.id = r.client_id
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_header_id;

    v_header_id := COALESCE(v_header_id, r.id);

    INSERT INTO public.campaign_lines (
      campaign_header_id, name, status, platform,
      po_amount, revenue, cost, currency_code,
      start_date, end_date, metadata, created_by, created_at, updated_at
    )
    VALUES (
      v_header_id,
      r.name || ' — Main line',
      r.status,
      COALESCE(r.metadata ->> 'platform', NULL),
      r.budget,
      r.budget,
      r.spent,
      r.currency,
      r.start_date,
      r.end_date,
      r.metadata,
      r.created_by,
      r.created_at,
      r.updated_at
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Point campaign_influencers at campaign_headers (same UUID after migration)
ALTER TABLE public.campaign_influencers ADD COLUMN IF NOT EXISTS campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE CASCADE;
ALTER TABLE public.campaign_influencers ADD COLUMN IF NOT EXISTS campaign_line_id uuid REFERENCES public.campaign_lines (id) ON DELETE SET NULL;

UPDATE public.campaign_influencers ci
SET campaign_header_id = ci.campaign_id
WHERE campaign_header_id IS NULL AND EXISTS (SELECT 1 FROM public.campaign_headers ch WHERE ch.id = ci.campaign_id);

-- campaign_members → campaign_headers
ALTER TABLE public.campaign_members ADD COLUMN IF NOT EXISTS campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE CASCADE;

UPDATE public.campaign_members cm
SET campaign_header_id = cm.campaign_id
WHERE campaign_header_id IS NULL AND EXISTS (SELECT 1 FROM public.campaign_headers ch WHERE ch.id = cm.campaign_id);

-- -----------------------------------------------------------------------------
-- RLS enable
-- -----------------------------------------------------------------------------
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_report_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_vr_rates ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.groups FORCE ROW LEVEL SECURITY;
ALTER TABLE public.brands FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agencies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_headers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_lines FORCE ROW LEVEL SECURITY;

-- Access helpers
CREATE OR REPLACE FUNCTION public.can_access_brand(p_brand_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = p_brand_id AND public.can_access_client(b.client_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_campaign_header(p_header_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.campaign_headers h
      WHERE h.id = p_header_id
        AND (
          h.account_manager_id = auth.uid()
          OR h.created_by = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_header_id = p_header_id
        AND cm.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaign_headers h
      JOIN public.client_users cu ON cu.client_id = h.client_id
      WHERE h.id = p_header_id AND cu.profile_id = auth.uid()
    )
    OR public.can_access_client(
      (SELECT client_id FROM public.campaign_headers WHERE id = p_header_id)
    );
$$;

-- Policies (idempotent)
DROP POLICY IF EXISTS groups_select ON public.groups;
CREATE POLICY groups_select ON public.groups FOR SELECT TO authenticated
  USING (public.has_permission('clients.read'));

DROP POLICY IF EXISTS groups_write ON public.groups;
CREATE POLICY groups_write ON public.groups FOR ALL TO authenticated
  USING (public.has_permission('clients.write'))
  WITH CHECK (public.has_permission('clients.write'));

DROP POLICY IF EXISTS brands_select ON public.brands;
CREATE POLICY brands_select ON public.brands FOR SELECT TO authenticated
  USING (public.can_access_client(client_id));

DROP POLICY IF EXISTS brands_write ON public.brands;
CREATE POLICY brands_write ON public.brands FOR ALL TO authenticated
  USING (public.has_permission('clients.write') AND public.can_access_client(client_id))
  WITH CHECK (public.has_permission('clients.write') AND public.can_access_client(client_id));

DROP POLICY IF EXISTS agencies_select ON public.agencies;
CREATE POLICY agencies_select ON public.agencies FOR SELECT TO authenticated
  USING (public.has_permission('influencers.read'));

DROP POLICY IF EXISTS agencies_write ON public.agencies;
CREATE POLICY agencies_write ON public.agencies FOR ALL TO authenticated
  USING (public.has_permission('influencers.write'))
  WITH CHECK (public.has_permission('influencers.write'));

DROP POLICY IF EXISTS campaign_headers_select ON public.campaign_headers;
CREATE POLICY campaign_headers_select ON public.campaign_headers FOR SELECT TO authenticated
  USING (public.has_permission('campaigns.read') AND public.can_access_campaign_header(id));

DROP POLICY IF EXISTS campaign_headers_write ON public.campaign_headers;
CREATE POLICY campaign_headers_write ON public.campaign_headers FOR ALL TO authenticated
  USING (public.has_permission('campaigns.write') AND public.can_access_client(client_id))
  WITH CHECK (public.has_permission('campaigns.write') AND public.can_access_client(client_id));

DROP POLICY IF EXISTS campaign_lines_select ON public.campaign_lines;
CREATE POLICY campaign_lines_select ON public.campaign_lines FOR SELECT TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS campaign_lines_write ON public.campaign_lines;
CREATE POLICY campaign_lines_write ON public.campaign_lines FOR ALL TO authenticated
  USING (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  )
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  );

-- Master data: read all authenticated, write admin/internal
DROP POLICY IF EXISTS md_read ON public.md_categories;
CREATE POLICY md_categories_select ON public.md_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS md_subcategories_select ON public.md_subcategories;
CREATE POLICY md_subcategories_select ON public.md_subcategories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS md_currencies_select ON public.md_currencies;
CREATE POLICY md_currencies_select ON public.md_currencies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS md_countries_select ON public.md_countries;
CREATE POLICY md_countries_select ON public.md_countries FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS md_teams_select ON public.md_teams;
CREATE POLICY md_teams_select ON public.md_teams FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS md_report_types_select ON public.md_report_types;
CREATE POLICY md_report_types_select ON public.md_report_types FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS md_payment_terms_select ON public.md_payment_terms;
CREATE POLICY md_payment_terms_select ON public.md_payment_terms FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS md_vr_rates_select ON public.md_vr_rates;
CREATE POLICY md_vr_rates_select ON public.md_vr_rates FOR SELECT TO authenticated USING (true);

-- Compatibility view: legacy campaigns queries → campaign_headers
-- Fresh bootstraps create public.campaigns as a TABLE (schema.sql). Rename it so
-- the view can take that name while preserving FK targets for campaign_id columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'campaigns'
      AND c.relkind = 'r'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'campaigns_legacy'
    ) THEN
      RAISE EXCEPTION
        'Cannot rename public.campaigns to campaigns_legacy: target already exists';
    END IF;

    ALTER TABLE public.campaigns RENAME TO campaigns_legacy;
    COMMENT ON TABLE public.campaigns_legacy IS
      'Pre-hierarchy campaigns table retained for FK compatibility. Prefer campaign_headers.';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.campaigns AS
SELECT
  h.id,
  h.document_number,
  h.client_id,
  h.name,
  h.description,
  h.brief,
  h.status,
  COALESCE((SELECT SUM(l.po_amount) FROM public.campaign_lines l WHERE l.campaign_header_id = h.id), 0) AS budget,
  COALESCE((SELECT SUM(l.cost) FROM public.campaign_lines l WHERE l.campaign_header_id = h.id), 0) AS spent,
  h.currency_code AS currency,
  h.start_date,
  h.end_date,
  h.account_manager_id,
  h.objectives,
  h.metadata,
  h.created_by,
  h.created_at,
  h.updated_at
FROM public.campaign_headers h;
