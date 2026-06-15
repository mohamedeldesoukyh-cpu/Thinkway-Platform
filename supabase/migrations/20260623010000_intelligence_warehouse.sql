-- Thinkway Intelligence Warehouse (Phase 2)
-- Isolated schema — no FK to operational billing/finance tables.

CREATE SCHEMA IF NOT EXISTS intelligence;

-- Permissions (read-only UI; ETL uses service_role)
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('intelligence.read', 'intelligence', 'read', 'View historical intelligence warehouse and benchmarks')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('super_admin', 'admin', 'account_manager', 'operations', 'finance')
  AND p.slug = 'intelligence.read'
ON CONFLICT DO NOTHING;

-- Raw layer
CREATE TABLE IF NOT EXISTS intelligence.historical_campaigns_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_sheet text NOT NULL CHECK (source_sheet IN ('2023', '2024', '2025', '2026')),
  source_row_number int NOT NULL,
  loaded_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_hash text NOT NULL,
  CONSTRAINT historical_campaigns_raw_sheet_row_hash_key UNIQUE (source_sheet, source_row_number, row_hash)
);

CREATE INDEX IF NOT EXISTS historical_campaigns_raw_sheet_idx
  ON intelligence.historical_campaigns_raw (source_sheet);
CREATE INDEX IF NOT EXISTS historical_campaigns_raw_loaded_at_idx
  ON intelligence.historical_campaigns_raw (loaded_at DESC);

CREATE TABLE IF NOT EXISTS intelligence.historical_influencers_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_row_number int NOT NULL,
  loaded_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_hash text NOT NULL,
  CONSTRAINT historical_influencers_raw_row_hash_key UNIQUE (source_row_number, row_hash)
);

-- Warehouse layer
CREATE TABLE IF NOT EXISTS intelligence.int_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name_raw text NOT NULL,
  group_name_raw text,
  client_type_report text,
  client_age_bucket text,
  category_raw text,
  subcategory_raw text,
  resolved_group_id uuid,
  resolved_client_id uuid,
  match_confidence numeric(5, 4) NOT NULL DEFAULT 0,
  source_keys text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT int_clients_name_group_key UNIQUE (client_name_raw, group_name_raw)
);

CREATE TABLE IF NOT EXISTS intelligence.int_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name_raw text NOT NULL,
  client_name_raw text,
  commercial_model text,
  category_raw text,
  subcategory_raw text,
  resolved_brand_id uuid,
  match_confidence numeric(5, 4) NOT NULL DEFAULT 0,
  source_keys text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT int_brands_name_client_key UNIQUE (brand_name_raw, client_name_raw)
);

CREATE TABLE IF NOT EXISTS intelligence.int_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name_raw text NOT NULL,
  legacy_name text,
  username text,
  platform text,
  country text,
  nationality text,
  gender text,
  tier text,
  content_category text,
  resolved_influencer_id uuid,
  match_confidence numeric(5, 4) NOT NULL DEFAULT 0,
  source_keys text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS int_influencers_identity_idx
  ON intelligence.int_influencers (
    lower(trim(display_name_raw)),
    coalesce(lower(trim(username)), ''),
    coalesce(lower(trim(platform)), '')
  );

CREATE TABLE IF NOT EXISTS intelligence.int_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_line_id text NOT NULL,
  source_campaign_key text,
  source_line_key text,
  source_sheet text NOT NULL,
  source_row_number int,
  raw_id uuid REFERENCES intelligence.historical_campaigns_raw (id) ON DELETE SET NULL,
  ad_live_month text,
  ad_live_date date,
  budget_month text,
  campaign_name text,
  campaign_type text,
  market_entity text,
  channel text,
  went_live boolean,
  ad_live_week int,
  revenue_usd numeric(14, 2),
  cost_usd numeric(14, 2),
  gp_usd numeric(14, 2),
  margin_pct numeric(8, 4),
  markup_pct numeric(8, 4),
  io_amount_local numeric(14, 2),
  io_currency text,
  billing_moved text,
  invoiced_flag text,
  invoice_number_ref text,
  vendor_paid_flag text,
  locked_flag text,
  direct_agency text,
  client_type_report text,
  ops_team text,
  planning_status text,
  category_raw text,
  subcategory_raw text,
  agency_name_raw text,
  account_manager_raw text,
  influencer_name_raw text,
  client_name_raw text,
  group_name_raw text,
  brand_name_raw text,
  int_client_id uuid REFERENCES intelligence.int_clients (id) ON DELETE SET NULL,
  int_brand_id uuid REFERENCES intelligence.int_brands (id) ON DELETE SET NULL,
  int_influencer_id uuid REFERENCES intelligence.int_influencers (id) ON DELETE SET NULL,
  resolved_header_id uuid,
  resolved_line_id uuid,
  match_confidence numeric(5, 4) NOT NULL DEFAULT 0,
  period_year int,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT int_campaigns_source_line_id_key UNIQUE (source_line_id)
);

CREATE INDEX IF NOT EXISTS int_campaigns_sheet_idx ON intelligence.int_campaigns (source_sheet);
CREATE INDEX IF NOT EXISTS int_campaigns_market_idx ON intelligence.int_campaigns (market_entity);
CREATE INDEX IF NOT EXISTS int_campaigns_channel_idx ON intelligence.int_campaigns (channel);
CREATE INDEX IF NOT EXISTS int_campaigns_influencer_idx ON intelligence.int_campaigns (int_influencer_id);
CREATE INDEX IF NOT EXISTS int_campaigns_year_idx ON intelligence.int_campaigns (period_year);

CREATE TABLE IF NOT EXISTS intelligence.int_pricing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  int_influencer_id uuid REFERENCES intelligence.int_influencers (id) ON DELETE CASCADE,
  rate_text text,
  parsed_rate_usd numeric(14, 2),
  parsed_rate_local numeric(14, 2),
  currency text,
  platform text,
  effective_period text,
  source text NOT NULL CHECK (source IN ('database_sheet', 'implied_from_line')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS int_pricing_history_influencer_idx
  ON intelligence.int_pricing_history (int_influencer_id);

CREATE TABLE IF NOT EXISTS intelligence.int_margin_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  int_campaign_id uuid NOT NULL REFERENCES intelligence.int_campaigns (id) ON DELETE CASCADE,
  source_line_id text NOT NULL,
  revenue_usd numeric(14, 2),
  cost_usd numeric(14, 2),
  gp_usd numeric(14, 2),
  margin_pct numeric(8, 4),
  markup_pct numeric(8, 4),
  market_entity text,
  channel text,
  campaign_type text,
  category_raw text,
  brand_name_raw text,
  influencer_tier text,
  below_threshold_15pct boolean NOT NULL DEFAULT false,
  period_year int,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT int_margin_history_campaign_key UNIQUE (int_campaign_id)
);

CREATE INDEX IF NOT EXISTS int_margin_history_threshold_idx
  ON intelligence.int_margin_history (below_threshold_15pct)
  WHERE below_threshold_15pct = true;

CREATE TABLE IF NOT EXISTS intelligence.int_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_key text NOT NULL,
  period_year int,
  median_cost_usd numeric(14, 2),
  p25_cost_usd numeric(14, 2),
  p75_cost_usd numeric(14, 2),
  median_revenue_usd numeric(14, 2),
  median_margin_pct numeric(8, 4),
  p25_margin_pct numeric(8, 4),
  p75_margin_pct numeric(8, 4),
  sample_size int NOT NULL DEFAULT 0,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT int_benchmarks_key_year_unique UNIQUE (benchmark_key, period_year)
);

CREATE INDEX IF NOT EXISTS int_benchmarks_dimensions_idx
  ON intelligence.int_benchmarks USING gin (dimensions);

CREATE TABLE IF NOT EXISTS intelligence.entity_resolution_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('client', 'brand', 'influencer', 'campaign_header', 'campaign_line')),
  source_key text NOT NULL,
  resolved_id uuid NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT entity_resolution_overrides_type_key UNIQUE (entity_type, source_key)
);

-- RLS: authenticated internal read-only
ALTER TABLE intelligence.historical_campaigns_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence.historical_influencers_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence.int_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence.int_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence.int_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence.int_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence.int_pricing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence.int_margin_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence.int_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence.entity_resolution_overrides ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION intelligence.can_read_intelligence()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, intelligence
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND public.is_internal_user()
    AND (
      public.has_permission('intelligence.read')
      OR public.has_permission('campaigns.read')
    );
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'historical_campaigns_raw',
    'historical_influencers_raw',
    'int_clients',
    'int_brands',
    'int_influencers',
    'int_campaigns',
    'int_pricing_history',
    'int_margin_history',
    'int_benchmarks',
    'entity_resolution_overrides'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY intelligence_%s_select ON intelligence.%I FOR SELECT TO authenticated USING (intelligence.can_read_intelligence())',
      t,
      t
    );
  END LOOP;
END $$;

-- Grant schema usage to authenticated and service_role
GRANT USAGE ON SCHEMA intelligence TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA intelligence TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA intelligence TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA intelligence
  GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA intelligence
  GRANT ALL ON TABLES TO service_role;
