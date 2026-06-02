-- Collections, treasury & cashflow ERP (Phase 4)
-- Idempotent — safe to re-run

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'collection_status'
      AND e.enumlabel = 'disputed'
  ) THEN
    ALTER TYPE public.collection_status ADD VALUE IF NOT EXISTS 'disputed';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments (id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE RESTRICT,
  allocated_amount numeric(14, 2) NOT NULL,
  currency_code char(3) NOT NULL DEFAULT 'USD',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT payment_allocations_amount_positive CHECK (allocated_amount > 0)
);

CREATE INDEX IF NOT EXISTS payment_allocations_payment_idx
  ON public.payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS payment_allocations_invoice_idx
  ON public.payment_allocations (invoice_id);

INSERT INTO public.permissions (slug, module, action, description)
VALUES
  ('collections.read', 'collections', 'read', 'View collections, AR aging, and client statements'),
  ('collections.write', 'collections', 'write', 'Record payments and allocate collections'),
  ('treasury.read', 'treasury', 'read', 'View treasury and cashflow dashboards')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('super_admin', 'admin', 'finance')
  AND p.slug IN ('collections.read', 'collections.write', 'treasury.read')
ON CONFLICT DO NOTHING;

ALTER TABLE public.collection_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

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
  );

DROP POLICY IF EXISTS payment_allocations_insert ON public.payment_allocations;
CREATE POLICY payment_allocations_insert ON public.payment_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('collections.write')
  );

GRANT SELECT, INSERT ON public.collection_audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.payment_allocations TO authenticated;
