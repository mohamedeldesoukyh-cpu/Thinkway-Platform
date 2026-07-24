-- =============================================================================
-- P0 follow-up: harden remaining finance SELECT USING(true) policies + FORCE RLS
-- Tables: po_governance_logs, finance_notifications, campaign_purchase_orders
-- Also FORCE RLS on finance-adjacent tables still missing it.
-- Depends on helpers from 20260724150000_finance_fx_rls_least_privilege.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- po_governance_logs
-- -----------------------------------------------------------------------------
ALTER TABLE public.po_governance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_governance_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS po_governance_logs_select ON public.po_governance_logs;
DROP POLICY IF EXISTS po_governance_logs_insert ON public.po_governance_logs;
DROP POLICY IF EXISTS po_governance_logs_update ON public.po_governance_logs;
DROP POLICY IF EXISTS po_governance_logs_delete ON public.po_governance_logs;

CREATE POLICY po_governance_logs_select ON public.po_governance_logs
  FOR SELECT TO authenticated
  USING (
    public.can_read_finance_control()
    AND public.can_access_finance_campaign(campaign_header_id)
  );

CREATE POLICY po_governance_logs_insert ON public.po_governance_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_write_finance_control()
    AND public.can_write_finance_campaign(campaign_header_id)
  );

-- -----------------------------------------------------------------------------
-- finance_notifications
-- -----------------------------------------------------------------------------
ALTER TABLE public.finance_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_notifications_select ON public.finance_notifications;
DROP POLICY IF EXISTS finance_notifications_insert ON public.finance_notifications;
DROP POLICY IF EXISTS finance_notifications_update ON public.finance_notifications;
DROP POLICY IF EXISTS finance_notifications_delete ON public.finance_notifications;

CREATE POLICY finance_notifications_select ON public.finance_notifications
  FOR SELECT TO authenticated
  USING (
    public.can_read_finance_control()
    AND (
      campaign_header_id IS NULL
      OR public.can_access_finance_campaign(campaign_header_id)
    )
  );

CREATE POLICY finance_notifications_insert ON public.finance_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_write_finance_control()
    AND (
      campaign_header_id IS NULL
      OR public.can_write_finance_campaign(campaign_header_id)
    )
  );

-- -----------------------------------------------------------------------------
-- campaign_purchase_orders
-- -----------------------------------------------------------------------------
ALTER TABLE public.campaign_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_purchase_orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_purchase_orders_select ON public.campaign_purchase_orders;
DROP POLICY IF EXISTS campaign_purchase_orders_insert ON public.campaign_purchase_orders;
DROP POLICY IF EXISTS campaign_purchase_orders_update ON public.campaign_purchase_orders;
DROP POLICY IF EXISTS campaign_purchase_orders_delete ON public.campaign_purchase_orders;
DROP POLICY IF EXISTS campaign_purchase_orders_write ON public.campaign_purchase_orders;

CREATE POLICY campaign_purchase_orders_select ON public.campaign_purchase_orders
  FOR SELECT TO authenticated
  USING (
    public.can_read_finance_control()
    AND public.can_access_finance_campaign(campaign_header_id)
  );

CREATE POLICY campaign_purchase_orders_insert ON public.campaign_purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_write_finance_control()
    AND public.can_write_finance_campaign(campaign_header_id)
  );

CREATE POLICY campaign_purchase_orders_update ON public.campaign_purchase_orders
  FOR UPDATE TO authenticated
  USING (
    public.can_write_finance_control()
    AND public.can_write_finance_campaign(campaign_header_id)
  )
  WITH CHECK (
    public.can_write_finance_control()
    AND public.can_write_finance_campaign(campaign_header_id)
  );

-- -----------------------------------------------------------------------------
-- FORCE RLS on remaining finance-adjacent tables (ENABLE already present)
-- -----------------------------------------------------------------------------
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_periods FORCE ROW LEVEL SECURITY;

ALTER TABLE public.period_lock_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_lock_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.finance_override_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_override_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.invoice_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.md_vat_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_vat_rates FORCE ROW LEVEL SECURITY;

-- Reference currency table: FORCE so owner/bypass cannot skip policies in app roles
ALTER TABLE public.md_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.md_currencies FORCE ROW LEVEL SECURITY;

COMMENT ON POLICY po_governance_logs_select ON public.po_governance_logs IS
  'P0: finance.read|write|override + campaign scope; portal denied.';
COMMENT ON POLICY finance_notifications_select ON public.finance_notifications IS
  'P0: finance.read|write|override + campaign scope; portal denied.';
COMMENT ON POLICY campaign_purchase_orders_select ON public.campaign_purchase_orders IS
  'P0: finance.read|write|override + campaign scope; portal denied.';
