-- =============================================================================
-- Financial planning & budget architecture (Sprint 3A)
-- budget_versions, budget_periods, budget_lines, budget_allocations,
-- forecast_versions, forecast_lines, planning_scenarios, planning_audit_logs
-- Idempotent — safe to re-run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'budget_version_status'
  ) THEN
    CREATE TYPE public.budget_version_status AS ENUM (
      'draft', 'submitted', 'approved', 'locked', 'archived'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'budget_period_type'
  ) THEN
    CREATE TYPE public.budget_period_type AS ENUM ('monthly', 'quarterly', 'yearly');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'forecast_version_status'
  ) THEN
    CREATE TYPE public.forecast_version_status AS ENUM ('draft', 'active', 'archived');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Scenarios (forecast-ready; minimal in 3A)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- -----------------------------------------------------------------------------
-- Budget versions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  name text NOT NULL,
  fiscal_year integer NOT NULL,
  status public.budget_version_status NOT NULL DEFAULT 'draft',
  scenario_id uuid REFERENCES public.planning_scenarios (id) ON DELETE SET NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  version_number integer NOT NULL DEFAULT 1,
  parent_version_id uuid REFERENCES public.budget_versions (id) ON DELETE SET NULL,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  locked_at timestamptz,
  locked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  archived_at timestamptz,
  archived_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT budget_versions_fiscal_year_check CHECK (fiscal_year >= 2000 AND fiscal_year <= 2100),
  CONSTRAINT budget_versions_currency_check
    CHECK (currency_code IN ('USD', 'AED', 'SAR', 'EGP', 'EUR', 'GBP'))
);

CREATE INDEX IF NOT EXISTS budget_versions_status_idx ON public.budget_versions (status);
CREATE INDEX IF NOT EXISTS budget_versions_fiscal_year_idx ON public.budget_versions (fiscal_year DESC);

-- -----------------------------------------------------------------------------
-- Budget periods
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_version_id uuid NOT NULL REFERENCES public.budget_versions (id) ON DELETE CASCADE,
  period_type public.budget_period_type NOT NULL,
  period_key text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT budget_periods_version_key_unique UNIQUE (budget_version_id, period_key),
  CONSTRAINT budget_periods_date_order_check CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS budget_periods_version_idx ON public.budget_periods (budget_version_id, sort_order);

-- -----------------------------------------------------------------------------
-- Budget lines (dimensional planning rows)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_version_id uuid NOT NULL REFERENCES public.budget_versions (id) ON DELETE CASCADE,
  budget_period_id uuid REFERENCES public.budget_periods (id) ON DELETE SET NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  country_code char(2) REFERENCES public.md_countries (code) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brands (id) ON DELETE SET NULL,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.md_teams (id) ON DELETE SET NULL,
  sales_owner_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  business_unit_id uuid REFERENCES public.groups (id) ON DELETE SET NULL,
  line_label text,
  revenue_budget numeric(14, 2) NOT NULL DEFAULT 0,
  cost_budget numeric(14, 2) NOT NULL DEFAULT 0,
  gp_budget numeric(14, 2) NOT NULL DEFAULT 0,
  margin_budget numeric(6, 2) NOT NULL DEFAULT 0,
  collections_budget numeric(14, 2) NOT NULL DEFAULT 0,
  vendor_cost_budget numeric(14, 2) NOT NULL DEFAULT 0,
  po_budget numeric(14, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT budget_lines_currency_check
    CHECK (currency_code IN ('USD', 'AED', 'SAR', 'EGP', 'EUR', 'GBP')),
  CONSTRAINT budget_lines_amounts_non_negative CHECK (
    revenue_budget >= 0 AND cost_budget >= 0 AND gp_budget >= 0
    AND collections_budget >= 0 AND vendor_cost_budget >= 0 AND po_budget >= 0
  ),
  CONSTRAINT budget_lines_margin_range CHECK (margin_budget >= 0 AND margin_budget <= 100)
);

CREATE INDEX IF NOT EXISTS budget_lines_version_idx ON public.budget_lines (budget_version_id);
CREATE INDEX IF NOT EXISTS budget_lines_period_idx ON public.budget_lines (budget_period_id);
CREATE INDEX IF NOT EXISTS budget_lines_client_idx ON public.budget_lines (client_id);
CREATE INDEX IF NOT EXISTS budget_lines_campaign_idx ON public.budget_lines (campaign_header_id);
CREATE INDEX IF NOT EXISTS budget_lines_team_idx ON public.budget_lines (team_id);
CREATE INDEX IF NOT EXISTS budget_lines_country_idx ON public.budget_lines (country_code);

-- -----------------------------------------------------------------------------
-- Budget allocations (split budget across targets)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budget_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_line_id uuid NOT NULL REFERENCES public.budget_lines (id) ON DELETE CASCADE,
  allocation_type text NOT NULL DEFAULT 'fixed',
  target_dimension text NOT NULL,
  target_id uuid,
  allocated_amount numeric(14, 2) NOT NULL DEFAULT 0,
  allocation_percent numeric(6, 2),
  currency_code char(3) NOT NULL DEFAULT 'USD',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT budget_allocations_amount_non_negative CHECK (allocated_amount >= 0),
  CONSTRAINT budget_allocations_percent_range CHECK (
    allocation_percent IS NULL OR (allocation_percent >= 0 AND allocation_percent <= 100)
  )
);

CREATE INDEX IF NOT EXISTS budget_allocations_line_idx ON public.budget_allocations (budget_line_id);

-- -----------------------------------------------------------------------------
-- Forecast versions & lines
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forecast_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  name text NOT NULL,
  fiscal_year integer NOT NULL,
  status public.forecast_version_status NOT NULL DEFAULT 'draft',
  budget_version_id uuid REFERENCES public.budget_versions (id) ON DELETE SET NULL,
  scenario_id uuid REFERENCES public.planning_scenarios (id) ON DELETE SET NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  version_number integer NOT NULL DEFAULT 1,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT forecast_versions_fiscal_year_check CHECK (fiscal_year >= 2000 AND fiscal_year <= 2100)
);

CREATE INDEX IF NOT EXISTS forecast_versions_status_idx ON public.forecast_versions (status);

CREATE TABLE IF NOT EXISTS public.forecast_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_version_id uuid NOT NULL REFERENCES public.forecast_versions (id) ON DELETE CASCADE,
  budget_period_id uuid REFERENCES public.budget_periods (id) ON DELETE SET NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  country_code char(2) REFERENCES public.md_countries (code) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brands (id) ON DELETE SET NULL,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.md_teams (id) ON DELETE SET NULL,
  sales_owner_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  business_unit_id uuid REFERENCES public.groups (id) ON DELETE SET NULL,
  line_label text,
  revenue_forecast numeric(14, 2) NOT NULL DEFAULT 0,
  cost_forecast numeric(14, 2) NOT NULL DEFAULT 0,
  gp_forecast numeric(14, 2) NOT NULL DEFAULT 0,
  margin_forecast numeric(6, 2) NOT NULL DEFAULT 0,
  collections_forecast numeric(14, 2) NOT NULL DEFAULT 0,
  vendor_cost_forecast numeric(14, 2) NOT NULL DEFAULT 0,
  po_forecast numeric(14, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT forecast_lines_amounts_non_negative CHECK (
    revenue_forecast >= 0 AND cost_forecast >= 0 AND gp_forecast >= 0
    AND collections_forecast >= 0 AND vendor_cost_forecast >= 0 AND po_forecast >= 0
  )
);

CREATE INDEX IF NOT EXISTS forecast_lines_version_idx ON public.forecast_lines (forecast_version_id);

-- -----------------------------------------------------------------------------
-- Planning audit log (audit-ready)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS planning_audit_logs_entity_idx
  ON public.planning_audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS planning_audit_logs_created_at_idx
  ON public.planning_audit_logs (created_at DESC);

-- -----------------------------------------------------------------------------
-- Planning helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.budget_version_is_read_only(p_status public.budget_version_status)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_status IN ('approved', 'locked', 'archived');
$$;

CREATE OR REPLACE FUNCTION public.budget_version_allows_line_write(p_version_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.budget_versions v
    WHERE v.id = p_version_id
      AND v.status IN ('draft', 'submitted')
  );
$$;

CREATE OR REPLACE FUNCTION public.forecast_version_allows_line_write(p_version_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.forecast_versions v
    WHERE v.id = p_version_id
      AND v.status IN ('draft', 'active')
  );
$$;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('planning.read', 'planning', 'read', 'View budgets, forecasts, and planning rollups'),
  ('planning.write', 'planning', 'write', 'Create and edit draft budget versions'),
  ('planning.approve', 'planning', 'approve', 'Submit and approve budget versions'),
  ('planning.forecast', 'planning', 'forecast', 'Manage forecast versions and lines')
ON CONFLICT (slug) DO UPDATE
  SET resource = EXCLUDED.resource,
      action = EXCLUDED.action,
      description = EXCLUDED.description,
      updated_at = timezone('utc', now());

WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (SELECT slug, id FROM public.permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON p.slug IN (
  'planning.read', 'planning.write', 'planning.approve', 'planning.forecast'
)
WHERE r.slug IN ('super_admin', 'admin', 'finance')
ON CONFLICT DO NOTHING;

-- Executive visibility: admin + finance full; account managers read
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (SELECT slug, id FROM public.permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON p.slug = 'planning.read'
WHERE r.slug IN ('account_manager')
ON CONFLICT DO NOTHING;

-- Analytics read for cross-module dashboards
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (SELECT slug, id FROM public.permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON p.slug = 'analytics.read'
WHERE r.slug IN ('super_admin', 'admin', 'finance')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.planning_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planning_scenarios_select ON public.planning_scenarios;
CREATE POLICY planning_scenarios_select ON public.planning_scenarios
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_permission('planning.read'));

DROP POLICY IF EXISTS planning_scenarios_write ON public.planning_scenarios;
CREATE POLICY planning_scenarios_write ON public.planning_scenarios
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('planning.write'))
  WITH CHECK (public.is_admin() OR public.has_permission('planning.write'));

DROP POLICY IF EXISTS budget_versions_select ON public.budget_versions;
CREATE POLICY budget_versions_select ON public.budget_versions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('planning.read')
    OR public.has_permission('analytics.read')
  );

DROP POLICY IF EXISTS budget_versions_insert ON public.budget_versions;
CREATE POLICY budget_versions_insert ON public.budget_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_permission('planning.write'));

DROP POLICY IF EXISTS budget_versions_update ON public.budget_versions;
CREATE POLICY budget_versions_update ON public.budget_versions
  FOR UPDATE TO authenticated
  USING (
    (public.is_admin() OR public.has_permission('planning.write'))
    AND status IN ('draft', 'submitted')
  )
  WITH CHECK (
    (public.is_admin() OR public.has_permission('planning.approve'))
    OR (
      (public.has_permission('planning.write'))
      AND status IN ('draft', 'submitted')
    )
  );

DROP POLICY IF EXISTS budget_versions_delete ON public.budget_versions;
CREATE POLICY budget_versions_delete ON public.budget_versions
  FOR DELETE TO authenticated
  USING (
    (public.is_admin() OR public.has_permission('planning.write'))
    AND status = 'draft'
  );

DROP POLICY IF EXISTS budget_periods_select ON public.budget_periods;
CREATE POLICY budget_periods_select ON public.budget_periods
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('planning.read')
    OR public.has_permission('analytics.read')
  );

DROP POLICY IF EXISTS budget_periods_write ON public.budget_periods;
CREATE POLICY budget_periods_write ON public.budget_periods
  FOR ALL TO authenticated
  USING (
    (public.is_admin() OR public.has_permission('planning.write'))
    AND public.budget_version_allows_line_write(budget_version_id)
  )
  WITH CHECK (
    (public.is_admin() OR public.has_permission('planning.write'))
    AND public.budget_version_allows_line_write(budget_version_id)
  );

DROP POLICY IF EXISTS budget_lines_select ON public.budget_lines;
CREATE POLICY budget_lines_select ON public.budget_lines
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('planning.read')
    OR public.has_permission('analytics.read')
    OR (
      public.has_permission('clients.read')
      AND (
        sales_owner_id = auth.uid()
        OR client_id IN (
          SELECT c.id FROM public.clients c WHERE c.account_manager_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS budget_lines_write ON public.budget_lines;
CREATE POLICY budget_lines_write ON public.budget_lines
  FOR ALL TO authenticated
  USING (
    (public.is_admin() OR public.has_permission('planning.write'))
    AND public.budget_version_allows_line_write(budget_version_id)
  )
  WITH CHECK (
    (public.is_admin() OR public.has_permission('planning.write'))
    AND public.budget_version_allows_line_write(budget_version_id)
  );

DROP POLICY IF EXISTS budget_allocations_select ON public.budget_allocations;
CREATE POLICY budget_allocations_select ON public.budget_allocations
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('planning.read')
    OR public.has_permission('analytics.read')
  );

DROP POLICY IF EXISTS budget_allocations_write ON public.budget_allocations;
CREATE POLICY budget_allocations_write ON public.budget_allocations
  FOR ALL TO authenticated
  USING (
    (public.is_admin() OR public.has_permission('planning.write'))
    AND EXISTS (
      SELECT 1 FROM public.budget_lines bl
      WHERE bl.id = budget_line_id
        AND public.budget_version_allows_line_write(bl.budget_version_id)
    )
  )
  WITH CHECK (
    (public.is_admin() OR public.has_permission('planning.write'))
    AND EXISTS (
      SELECT 1 FROM public.budget_lines bl
      WHERE bl.id = budget_line_id
        AND public.budget_version_allows_line_write(bl.budget_version_id)
    )
  );

DROP POLICY IF EXISTS forecast_versions_select ON public.forecast_versions;
CREATE POLICY forecast_versions_select ON public.forecast_versions
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('planning.read')
    OR public.has_permission('planning.forecast')
    OR public.has_permission('analytics.read')
  );

DROP POLICY IF EXISTS forecast_versions_write ON public.forecast_versions;
CREATE POLICY forecast_versions_write ON public.forecast_versions
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('planning.forecast'))
  WITH CHECK (public.is_admin() OR public.has_permission('planning.forecast'));

DROP POLICY IF EXISTS forecast_lines_select ON public.forecast_lines;
CREATE POLICY forecast_lines_select ON public.forecast_lines
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('planning.read')
    OR public.has_permission('planning.forecast')
    OR public.has_permission('analytics.read')
  );

DROP POLICY IF EXISTS forecast_lines_write ON public.forecast_lines;
CREATE POLICY forecast_lines_write ON public.forecast_lines
  FOR ALL TO authenticated
  USING (
    (public.is_admin() OR public.has_permission('planning.forecast'))
    AND public.forecast_version_allows_line_write(forecast_version_id)
  )
  WITH CHECK (
    (public.is_admin() OR public.has_permission('planning.forecast'))
    AND public.forecast_version_allows_line_write(forecast_version_id)
  );

DROP POLICY IF EXISTS planning_audit_logs_select ON public.planning_audit_logs;
CREATE POLICY planning_audit_logs_select ON public.planning_audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('planning.read')
    OR public.has_permission('audit.read')
  );

DROP POLICY IF EXISTS planning_audit_logs_insert ON public.planning_audit_logs;
CREATE POLICY planning_audit_logs_insert ON public.planning_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('planning.write')
    OR public.has_permission('planning.forecast')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_scenarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_lines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecast_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forecast_lines TO authenticated;
GRANT SELECT, INSERT ON public.planning_audit_logs TO authenticated;
