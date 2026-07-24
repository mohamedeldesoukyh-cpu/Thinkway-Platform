-- =============================================================================
-- P0 AuthZ hardening (authentication-audit.md P0-01 / P0-02)
-- - Replace finance control USING(true) / WITH CHECK(true) policies
-- - Least privilege via finance.read / finance.write / finance.override
-- - Client/org scoping for staff; portal roles denied (is_internal_user)
-- - FORCE RLS on finance control + exchange-rate tables
-- - Restrict md_exchange_rates writes to finance.override; reads to internal
-- Does not modify prior migrations.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('finance.read', 'finance', 'read', 'Read finance control documents, postings, and adjustments'),
  ('finance.write', 'finance', 'write', 'Create and update finance control documents and postings')
ON CONFLICT (slug) DO UPDATE
  SET resource = EXCLUDED.resource,
      action = EXCLUDED.action,
      description = EXCLUDED.description,
      updated_at = timezone('utc', now());

-- Ensure finance.override exists (created in earlier migrations; idempotent)
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('finance.override', 'finance', 'override', 'Override invoice/period locks and mutate FX rates')
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
JOIN perm_map p ON p.slug IN ('finance.read', 'finance.write', 'finance.override')
WHERE r.slug IN ('super_admin', 'admin', 'finance')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Helpers (portal roles excluded via is_internal_user)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_read_finance_control()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      public.is_internal_user()
      AND (
        public.has_permission('finance.read')
        OR public.has_permission('finance.write')
        OR public.has_permission('finance.override')
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_finance_control()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      public.is_internal_user()
      AND (
        public.has_permission('finance.write')
        OR public.has_permission('finance.override')
      )
    );
$$;

-- Client scope for finance control: internal + finance permission + can_access_client.
-- Portal users fail is_internal_user even when client_users membership would pass can_access_client.
CREATE OR REPLACE FUNCTION public.can_access_finance_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_read_finance_control()
    AND (
      p_client_id IS NULL
      OR public.can_access_client(p_client_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_finance_client(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_write_finance_control()
    AND (
      p_client_id IS NULL
      OR public.can_access_client(p_client_id)
    );
$$;

-- Campaign-scoped finance rows (vendor CN/DN) — still requires finance control + internal.
CREATE OR REPLACE FUNCTION public.can_access_finance_campaign(p_campaign_header_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_read_finance_control()
    AND (
      p_campaign_header_id IS NULL
      OR public.can_access_campaign_header(p_campaign_header_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_finance_campaign(p_campaign_header_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_write_finance_control()
    AND (
      p_campaign_header_id IS NULL
      OR public.can_access_campaign_header(p_campaign_header_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_exchange_rates()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      public.is_internal_user()
      AND public.has_permission('finance.override')
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_read_finance_control() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_finance_control() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_finance_client(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_finance_client(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_finance_campaign(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_finance_campaign(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_exchange_rates() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- FORCE RLS on finance control tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.finance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_posting_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_debit_notes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.finance_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_posting_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.erp_sync_queue FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_document_links FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_credit_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_credit_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_debit_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_debit_notes FORCE ROW LEVEL SECURITY;

-- Drop permissive placeholder policies
DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'finance_documents',
    'finance_posting_batches',
    'erp_sync_queue',
    'finance_document_links',
    'client_credit_notes',
    'vendor_credit_notes',
    'client_debit_notes',
    'vendor_debit_notes'
  ] LOOP
    FOREACH pol IN ARRAY ARRAY[
      t || '_select',
      t || '_insert',
      t || '_update',
      t || '_delete',
      t || '_write',
      t || '_all'
    ] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    END LOOP;
  END LOOP;
END $$;

-- finance_documents
CREATE POLICY finance_documents_select ON public.finance_documents
  FOR SELECT TO authenticated
  USING (public.can_access_finance_client(client_id));

CREATE POLICY finance_documents_insert ON public.finance_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_finance_client(client_id));

CREATE POLICY finance_documents_update ON public.finance_documents
  FOR UPDATE TO authenticated
  USING (public.can_write_finance_client(client_id))
  WITH CHECK (public.can_write_finance_client(client_id));

-- finance_posting_batches (legal_entity_id = client)
CREATE POLICY finance_posting_batches_select ON public.finance_posting_batches
  FOR SELECT TO authenticated
  USING (public.can_access_finance_client(legal_entity_id));

CREATE POLICY finance_posting_batches_insert ON public.finance_posting_batches
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_finance_client(legal_entity_id));

CREATE POLICY finance_posting_batches_update ON public.finance_posting_batches
  FOR UPDATE TO authenticated
  USING (public.can_write_finance_client(legal_entity_id))
  WITH CHECK (public.can_write_finance_client(legal_entity_id));

-- client credit / debit notes
CREATE POLICY client_credit_notes_select ON public.client_credit_notes
  FOR SELECT TO authenticated
  USING (public.can_access_finance_client(client_id));

CREATE POLICY client_credit_notes_insert ON public.client_credit_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_finance_client(client_id));

CREATE POLICY client_credit_notes_update ON public.client_credit_notes
  FOR UPDATE TO authenticated
  USING (public.can_write_finance_client(client_id))
  WITH CHECK (public.can_write_finance_client(client_id));

CREATE POLICY client_debit_notes_select ON public.client_debit_notes
  FOR SELECT TO authenticated
  USING (public.can_access_finance_client(client_id));

CREATE POLICY client_debit_notes_insert ON public.client_debit_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_finance_client(client_id));

CREATE POLICY client_debit_notes_update ON public.client_debit_notes
  FOR UPDATE TO authenticated
  USING (public.can_write_finance_client(client_id))
  WITH CHECK (public.can_write_finance_client(client_id));

-- vendor credit / debit notes (campaign scope)
CREATE POLICY vendor_credit_notes_select ON public.vendor_credit_notes
  FOR SELECT TO authenticated
  USING (public.can_access_finance_campaign(campaign_header_id));

CREATE POLICY vendor_credit_notes_insert ON public.vendor_credit_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_finance_campaign(campaign_header_id));

CREATE POLICY vendor_credit_notes_update ON public.vendor_credit_notes
  FOR UPDATE TO authenticated
  USING (public.can_write_finance_campaign(campaign_header_id))
  WITH CHECK (public.can_write_finance_campaign(campaign_header_id));

CREATE POLICY vendor_debit_notes_select ON public.vendor_debit_notes
  FOR SELECT TO authenticated
  USING (public.can_access_finance_campaign(campaign_header_id));

CREATE POLICY vendor_debit_notes_insert ON public.vendor_debit_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_finance_campaign(campaign_header_id));

CREATE POLICY vendor_debit_notes_update ON public.vendor_debit_notes
  FOR UPDATE TO authenticated
  USING (public.can_write_finance_campaign(campaign_header_id))
  WITH CHECK (public.can_write_finance_campaign(campaign_header_id));

-- finance_document_links via source document client scope
CREATE POLICY finance_document_links_select ON public.finance_document_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.finance_documents fd
      WHERE fd.id = source_document_id
        AND public.can_access_finance_client(fd.client_id)
    )
  );

CREATE POLICY finance_document_links_insert ON public.finance_document_links
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.finance_documents fd
      WHERE fd.id = source_document_id
        AND public.can_write_finance_client(fd.client_id)
    )
    AND EXISTS (
      SELECT 1
      FROM public.finance_documents fd
      WHERE fd.id = target_document_id
        AND public.can_write_finance_client(fd.client_id)
    )
  );

CREATE POLICY finance_document_links_update ON public.finance_document_links
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.finance_documents fd
      WHERE fd.id = source_document_id
        AND public.can_write_finance_client(fd.client_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.finance_documents fd
      WHERE fd.id = source_document_id
        AND public.can_write_finance_client(fd.client_id)
    )
    AND EXISTS (
      SELECT 1
      FROM public.finance_documents fd
      WHERE fd.id = target_document_id
        AND public.can_write_finance_client(fd.client_id)
    )
  );

-- erp_sync_queue via linked document or batch legal entity
CREATE POLICY erp_sync_queue_select ON public.erp_sync_queue
  FOR SELECT TO authenticated
  USING (
    public.can_read_finance_control()
    AND (
      (
        finance_document_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.finance_documents fd
          WHERE fd.id = finance_document_id
            AND public.can_access_finance_client(fd.client_id)
        )
      )
      OR (
        posting_batch_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.finance_posting_batches b
          WHERE b.id = posting_batch_id
            AND public.can_access_finance_client(b.legal_entity_id)
        )
      )
      OR (
        finance_document_id IS NULL
        AND posting_batch_id IS NULL
        AND public.can_read_finance_control()
      )
    )
  );

CREATE POLICY erp_sync_queue_insert ON public.erp_sync_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_write_finance_control()
    AND (
      (
        finance_document_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.finance_documents fd
          WHERE fd.id = finance_document_id
            AND public.can_write_finance_client(fd.client_id)
        )
      )
      OR (
        posting_batch_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.finance_posting_batches b
          WHERE b.id = posting_batch_id
            AND public.can_write_finance_client(b.legal_entity_id)
        )
      )
      OR (
        finance_document_id IS NULL
        AND posting_batch_id IS NULL
        AND public.can_write_finance_control()
      )
    )
  );

CREATE POLICY erp_sync_queue_update ON public.erp_sync_queue
  FOR UPDATE TO authenticated
  USING (
    public.can_write_finance_control()
    AND (
      (
        finance_document_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.finance_documents fd
          WHERE fd.id = finance_document_id
            AND public.can_write_finance_client(fd.client_id)
        )
      )
      OR (
        posting_batch_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.finance_posting_batches b
          WHERE b.id = posting_batch_id
            AND public.can_write_finance_client(b.legal_entity_id)
        )
      )
      OR (
        finance_document_id IS NULL
        AND posting_batch_id IS NULL
        AND public.can_write_finance_control()
      )
    )
  )
  WITH CHECK (
    public.can_write_finance_control()
    AND (
      (
        finance_document_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.finance_documents fd
          WHERE fd.id = finance_document_id
            AND public.can_write_finance_client(fd.client_id)
        )
      )
      OR (
        posting_batch_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.finance_posting_batches b
          WHERE b.id = posting_batch_id
            AND public.can_write_finance_client(b.legal_entity_id)
        )
      )
      OR (
        finance_document_id IS NULL
        AND posting_batch_id IS NULL
        AND public.can_write_finance_control()
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Exchange rates (P0-02)
-- -----------------------------------------------------------------------------
ALTER TABLE public.md_exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_exchange_rates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS md_exchange_rates_select ON public.md_exchange_rates;
DROP POLICY IF EXISTS md_exchange_rates_write ON public.md_exchange_rates;
DROP POLICY IF EXISTS md_exchange_rates_insert ON public.md_exchange_rates;
DROP POLICY IF EXISTS md_exchange_rates_update ON public.md_exchange_rates;
DROP POLICY IF EXISTS md_exchange_rates_delete ON public.md_exchange_rates;

CREATE POLICY md_exchange_rates_select ON public.md_exchange_rates
  FOR SELECT TO authenticated
  USING (public.is_internal_user());

CREATE POLICY md_exchange_rates_insert ON public.md_exchange_rates
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_exchange_rates());

CREATE POLICY md_exchange_rates_update ON public.md_exchange_rates
  FOR UPDATE TO authenticated
  USING (public.can_write_exchange_rates())
  WITH CHECK (public.can_write_exchange_rates());

CREATE POLICY md_exchange_rates_delete ON public.md_exchange_rates
  FOR DELETE TO authenticated
  USING (public.can_write_exchange_rates());

-- FX audit log: internal read; write only with finance.override
ALTER TABLE public.fx_rate_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rate_audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fx_rate_audit_logs_select ON public.fx_rate_audit_logs;
DROP POLICY IF EXISTS fx_rate_audit_logs_insert ON public.fx_rate_audit_logs;

CREATE POLICY fx_rate_audit_logs_select ON public.fx_rate_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_internal_user());

CREATE POLICY fx_rate_audit_logs_insert ON public.fx_rate_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_exchange_rates());

-- Currency master writes for FX workspace (reads remain authenticated SELECT)
DROP POLICY IF EXISTS md_currencies_insert ON public.md_currencies;
DROP POLICY IF EXISTS md_currencies_update ON public.md_currencies;
DROP POLICY IF EXISTS md_currencies_write ON public.md_currencies;

CREATE POLICY md_currencies_insert ON public.md_currencies
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_exchange_rates());

CREATE POLICY md_currencies_update ON public.md_currencies
  FOR UPDATE TO authenticated
  USING (public.can_write_exchange_rates())
  WITH CHECK (public.can_write_exchange_rates());

COMMENT ON FUNCTION public.can_read_finance_control() IS
  'P0: finance.read|write|override for internal users; denies portal roles.';
COMMENT ON FUNCTION public.can_write_exchange_rates() IS
  'P0: FX rate mutation requires finance.override (or admin).';
