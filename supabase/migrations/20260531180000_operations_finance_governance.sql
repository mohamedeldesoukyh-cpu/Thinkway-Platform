-- Enterprise Operations, Reassignment, and Financial Governance Engine
-- Extends billing engine — does NOT replace it.

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'movement_type') THEN
    CREATE TYPE public.movement_type AS ENUM (
      'brand_to_brand',
      'client_to_client',
      'group_to_group'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'movement_batch_status') THEN
    CREATE TYPE public.movement_batch_status AS ENUM (
      'draft',
      'preview',
      'executing',
      'completed',
      'failed',
      'cancelled'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'financial_period_status') THEN
    CREATE TYPE public.financial_period_status AS ENUM (
      'open',
      'soft_locked',
      'fully_locked'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'invoice_regeneration_status') THEN
    CREATE TYPE public.invoice_regeneration_status AS ENUM (
      'active',
      'pending_regeneration',
      'regenerated'
    );
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Movement batches & items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.movement_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  movement_type public.movement_type NOT NULL,
  status public.movement_batch_status NOT NULL DEFAULT 'draft',
  reason text NOT NULL,
  source_group_id uuid REFERENCES public.groups (id) ON DELETE SET NULL,
  source_client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  source_brand_id uuid REFERENCES public.brands (id) ON DELETE SET NULL,
  destination_group_id uuid REFERENCES public.groups (id) ON DELETE SET NULL,
  destination_client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  destination_brand_id uuid REFERENCES public.brands (id) ON DELETE SET NULL,
  campaign_count integer NOT NULL DEFAULT 0,
  total_revenue numeric(14, 2) NOT NULL DEFAULT 0,
  total_gp numeric(14, 2) NOT NULL DEFAULT 0,
  total_invoices integer NOT NULL DEFAULT 0,
  affected_collections integer NOT NULL DEFAULT 0,
  preview_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS movement_batches_status_idx ON public.movement_batches (status);
CREATE INDEX IF NOT EXISTS movement_batches_created_at_idx ON public.movement_batches (created_at DESC);

CREATE TABLE IF NOT EXISTS public.movement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.movement_batches (id) ON DELETE CASCADE,
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE RESTRICT,
  previous_group_id uuid,
  previous_client_id uuid,
  previous_brand_id uuid,
  new_group_id uuid,
  new_client_id uuid,
  new_brand_id uuid,
  revenue numeric(14, 2) NOT NULL DEFAULT 0,
  gp numeric(14, 2) NOT NULL DEFAULT 0,
  invoice_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS movement_items_batch_id_idx ON public.movement_items (batch_id);
CREATE INDEX IF NOT EXISTS movement_items_campaign_header_id_idx ON public.movement_items (campaign_header_id);

CREATE TABLE IF NOT EXISTS public.reassignment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.movement_batches (id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  moved_from jsonb NOT NULL DEFAULT '{}'::jsonb,
  moved_to jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  affected_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS reassignment_logs_entity_idx
  ON public.reassignment_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS reassignment_logs_batch_id_idx ON public.reassignment_logs (batch_id);

CREATE OR REPLACE FUNCTION public.assign_movement_batch_document_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(timezone('utc', now()), 'YYYY');
  v_prefix text := 'MOV-' || v_year;
  v_next bigint;
BEGIN
  IF NEW.document_number IS NULL OR btrim(NEW.document_number) = '' THEN
    INSERT INTO public.document_sequences AS ds (prefix, last_value)
    VALUES (v_prefix, 1)
    ON CONFLICT (prefix) DO UPDATE
      SET last_value = ds.last_value + 1
    RETURNING last_value INTO v_next;
    NEW.document_number := v_prefix || '-' || lpad(v_next::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_movement_batches_document_number ON public.movement_batches;
CREATE TRIGGER assign_movement_batches_document_number
  BEFORE INSERT ON public.movement_batches
  FOR EACH ROW EXECUTE FUNCTION public.assign_movement_batch_document_number();

-- -----------------------------------------------------------------------------
-- Invoice versioning & regeneration
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS regeneration_status public.invoice_regeneration_status NOT NULL DEFAULT 'active';

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS ungenerated_at timestamptz;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS ungenerated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS ungenerate_reason text;

CREATE TABLE IF NOT EXISTS public.invoice_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  line_items_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(14, 2) NOT NULL DEFAULT 0,
  subtotal numeric(14, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(14, 2) NOT NULL DEFAULT 0,
  regeneration_reason text,
  regenerated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT invoice_versions_unique UNIQUE (invoice_id, version_number)
);

CREATE INDEX IF NOT EXISTS invoice_versions_invoice_id_idx ON public.invoice_versions (invoice_id);

-- -----------------------------------------------------------------------------
-- Financial periods & lock governance
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  status public.financial_period_status NOT NULL DEFAULT 'open',
  locked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  locked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT financial_periods_unique UNIQUE (year, month)
);

CREATE INDEX IF NOT EXISTS financial_periods_status_idx ON public.financial_periods (status);

CREATE TABLE IF NOT EXISTS public.period_lock_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.financial_periods (id) ON DELETE CASCADE,
  previous_status public.financial_period_status,
  new_status public.financial_period_status NOT NULL,
  reason text NOT NULL,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.finance_override_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  override_type text NOT NULL,
  reason text NOT NULL,
  granted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  granted_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS finance_override_logs_entity_idx
  ON public.finance_override_logs (entity_type, entity_id);

-- Period lock helper
CREATE OR REPLACE FUNCTION public.get_financial_period_lock_level(p_date date)
RETURNS public.financial_period_status
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT fp.status
      FROM public.financial_periods fp
      WHERE fp.year = EXTRACT(YEAR FROM p_date)::integer
        AND fp.month = EXTRACT(MONTH FROM p_date)::integer
      LIMIT 1
    ),
    'open'::public.financial_period_status
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_financial_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock public.financial_period_status;
  v_ref_date date;
  v_override_active boolean;
BEGIN
  v_ref_date := COALESCE(NEW.billing_invoiced_at::date, NEW.updated_at::date, CURRENT_DATE);
  v_lock := public.get_financial_period_lock_level(v_ref_date);

  v_override_active := NEW.finance_override_until IS NOT NULL
    AND NEW.finance_override_until > timezone('utc', now());

  IF v_lock = 'fully_locked' AND NOT v_override_active THEN
    IF TG_OP = 'UPDATE' AND (
      NEW.revenue IS DISTINCT FROM OLD.revenue
      OR NEW.cost IS DISTINCT FROM OLD.cost
      OR NEW.billing_status IS DISTINCT FROM OLD.billing_status
    ) THEN
      RAISE EXCEPTION 'Financial period is fully locked. Finance override required.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_financial_period_lock ON public.campaign_lines;
CREATE TRIGGER enforce_financial_period_lock
  BEFORE UPDATE ON public.campaign_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_financial_period_lock();

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('operations.read', 'operations', 'read', 'View operations and reassignment center'),
  ('operations.write', 'operations', 'write', 'Execute campaign and entity movements'),
  ('finance.periods', 'finance', 'periods', 'Manage financial period locks'),
  ('finance.override', 'finance', 'override', 'Override invoice and period locks'),
  ('finance.regenerate', 'finance', 'regenerate', 'Un-generate and regenerate invoices')
ON CONFLICT (slug) DO UPDATE
  SET resource = EXCLUDED.resource,
      action = EXCLUDED.action,
      description = EXCLUDED.description,
      updated_at = timezone('utc', now());

-- Grant new permissions to privileged roles
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (SELECT slug, id FROM public.permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON p.slug IN (
  'operations.read', 'operations.write',
  'finance.periods', 'finance.override', 'finance.regenerate'
)
WHERE r.slug IN ('super_admin', 'admin', 'finance', 'operations')
ON CONFLICT DO NOTHING;

-- Finance gets override + regenerate + periods
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (SELECT slug, id FROM public.permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON p.slug IN ('finance.periods', 'finance.override', 'finance.regenerate')
WHERE r.slug = 'finance'
ON CONFLICT DO NOTHING;

-- Operations gets read + write
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (SELECT slug, id FROM public.permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON p.slug IN ('operations.read', 'operations.write')
WHERE r.slug = 'operations'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.movement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reassignment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_lock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_override_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS movement_batches_select ON public.movement_batches;
CREATE POLICY movement_batches_select ON public.movement_batches
  FOR SELECT TO authenticated USING (public.is_admin() OR public.has_permission('operations.read'));

DROP POLICY IF EXISTS movement_batches_write ON public.movement_batches;
CREATE POLICY movement_batches_write ON public.movement_batches
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('operations.write'))
  WITH CHECK (public.is_admin() OR public.has_permission('operations.write'));

DROP POLICY IF EXISTS movement_items_select ON public.movement_items;
CREATE POLICY movement_items_select ON public.movement_items
  FOR SELECT TO authenticated USING (public.is_admin() OR public.has_permission('operations.read'));

DROP POLICY IF EXISTS movement_items_write ON public.movement_items;
CREATE POLICY movement_items_write ON public.movement_items
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('operations.write'))
  WITH CHECK (public.is_admin() OR public.has_permission('operations.write'));

DROP POLICY IF EXISTS reassignment_logs_select ON public.reassignment_logs;
CREATE POLICY reassignment_logs_select ON public.reassignment_logs
  FOR SELECT TO authenticated USING (public.is_admin() OR public.has_permission('operations.read') OR public.has_permission('audit.read'));

DROP POLICY IF EXISTS invoice_versions_select ON public.invoice_versions;
CREATE POLICY invoice_versions_select ON public.invoice_versions
  FOR SELECT TO authenticated USING (public.is_admin() OR public.has_permission('invoices.read'));

DROP POLICY IF EXISTS invoice_versions_write ON public.invoice_versions;
CREATE POLICY invoice_versions_write ON public.invoice_versions
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('finance.regenerate'))
  WITH CHECK (public.is_admin() OR public.has_permission('finance.regenerate'));

DROP POLICY IF EXISTS financial_periods_select ON public.financial_periods;
CREATE POLICY financial_periods_select ON public.financial_periods
  FOR SELECT TO authenticated USING (public.is_admin() OR public.has_permission('finance.periods') OR public.has_permission('invoices.read'));

DROP POLICY IF EXISTS financial_periods_write ON public.financial_periods;
CREATE POLICY financial_periods_write ON public.financial_periods
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.has_permission('finance.periods'))
  WITH CHECK (public.is_admin() OR public.has_permission('finance.periods'));

DROP POLICY IF EXISTS period_lock_logs_select ON public.period_lock_logs;
CREATE POLICY period_lock_logs_select ON public.period_lock_logs
  FOR SELECT TO authenticated USING (public.is_admin() OR public.has_permission('finance.periods'));

DROP POLICY IF EXISTS finance_override_logs_select ON public.finance_override_logs;
CREATE POLICY finance_override_logs_select ON public.finance_override_logs
  FOR SELECT TO authenticated USING (public.is_admin() OR public.has_permission('finance.override') OR public.has_permission('audit.read'));

DROP POLICY IF EXISTS finance_override_logs_write ON public.finance_override_logs;
CREATE POLICY finance_override_logs_write ON public.finance_override_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_permission('finance.override'));

-- Audit triggers
DROP TRIGGER IF EXISTS audit_movement_batches ON public.movement_batches;
CREATE TRIGGER audit_movement_batches
  AFTER INSERT OR UPDATE OR DELETE ON public.movement_batches
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

DROP TRIGGER IF EXISTS set_movement_batches_updated_at ON public.movement_batches;
CREATE TRIGGER set_movement_batches_updated_at
  BEFORE UPDATE ON public.movement_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_financial_periods_updated_at ON public.financial_periods;
CREATE TRIGGER set_financial_periods_updated_at
  BEFORE UPDATE ON public.financial_periods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
