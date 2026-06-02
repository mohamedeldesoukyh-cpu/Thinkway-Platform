-- =============================================================================
-- Collections, treasury & cashflow ERP (Phase 4)
-- collection_audit_logs, payment_allocations, disputed collection status,
-- collections/treasury permissions and RLS
-- Idempotent — safe to re-run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- collection_status: disputed (manual AR workflow)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'collection_status'
      AND e.enumlabel = 'disputed'
  ) THEN
    ALTER TYPE public.collection_status ADD VALUE IF NOT EXISTS 'disputed';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Collection audit trail
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collection_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS collection_audit_logs_entity_idx
  ON public.collection_audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS collection_audit_logs_created_at_idx
  ON public.collection_audit_logs (created_at DESC);

-- -----------------------------------------------------------------------------
-- Payment ↔ invoice allocation (multi-invoice batch payments)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments (id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE RESTRICT,
  allocated_amount numeric(14, 2) NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT payment_allocations_amount_positive CHECK (allocated_amount > 0),
  CONSTRAINT payment_allocations_currency_check CHECK (char_length(currency_code) = 3),
  CONSTRAINT payment_allocations_payment_invoice_unique UNIQUE (payment_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS payment_allocations_payment_idx
  ON public.payment_allocations (payment_id);

CREATE INDEX IF NOT EXISTS payment_allocations_invoice_idx
  ON public.payment_allocations (invoice_id);

-- -----------------------------------------------------------------------------
-- Permissions (slug, resource, action, description — no module column)
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  (
    'collections.read',
    'collections',
    'read',
    'View collections, AR aging, and client statements'
  ),
  (
    'collections.write',
    'collections',
    'write',
    'Record payments and allocate collections'
  ),
  (
    'treasury.read',
    'treasury',
    'read',
    'View treasury and cashflow dashboards'
  )
ON CONFLICT (slug) DO UPDATE
  SET
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    description = EXCLUDED.description,
    updated_at = timezone('utc', now());

-- Finance + admin: full collections & treasury access
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (SELECT slug, id FROM public.permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON p.slug IN (
  'collections.read',
  'collections.write',
  'treasury.read'
)
WHERE r.slug IN ('super_admin', 'admin', 'finance')
ON CONFLICT DO NOTHING;

-- Account managers: read collections & treasury dashboards
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (SELECT slug, id FROM public.permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON p.slug IN ('collections.read', 'treasury.read')
WHERE r.slug = 'account_manager'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.collection_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.collection_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collection_audit_logs_select ON public.collection_audit_logs;
CREATE POLICY collection_audit_logs_select ON public.collection_audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('collections.read')
    OR public.has_permission('audit.read')
  );

DROP POLICY IF EXISTS collection_audit_logs_insert ON public.collection_audit_logs;
CREATE POLICY collection_audit_logs_insert ON public.collection_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('collections.write')
  );

DROP POLICY IF EXISTS payment_allocations_select ON public.payment_allocations;
CREATE POLICY payment_allocations_select ON public.payment_allocations
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('collections.read')
    OR public.has_permission('treasury.read')
    OR public.has_permission('payments.read')
  );

DROP POLICY IF EXISTS payment_allocations_insert ON public.payment_allocations;
CREATE POLICY payment_allocations_insert ON public.payment_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('collections.write')
    OR public.has_permission('payments.write')
  );

DROP POLICY IF EXISTS payment_allocations_update ON public.payment_allocations;
CREATE POLICY payment_allocations_update ON public.payment_allocations
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('collections.write')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('collections.write')
  );

DROP POLICY IF EXISTS payment_allocations_delete ON public.payment_allocations;
CREATE POLICY payment_allocations_delete ON public.payment_allocations
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('collections.write')
  );

GRANT SELECT, INSERT ON public.collection_audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_allocations TO authenticated;
