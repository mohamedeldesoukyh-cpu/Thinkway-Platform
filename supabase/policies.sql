-- =============================================================
-- Thinkway Platform — Row Level Security Policies
-- Apply AFTER schema.sql
-- =============================================================

-- =============================================================
-- HELPER: get the current user's role (STABLE = cached per query)
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.profiles WHERE id = auth.uid()
$$;

-- =============================================================
-- ENABLE RLS
-- =============================================================
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_comments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- PROFILES
-- =============================================================
DROP POLICY IF EXISTS "profiles: users can read own" ON public.profiles;
CREATE POLICY "profiles: users can read own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles: privileged roles can read all" ON public.profiles;
CREATE POLICY "profiles: privileged roles can read all"
  ON public.profiles FOR SELECT
  USING (get_my_role() IN ('admin', 'director', 'manager'));

DROP POLICY IF EXISTS "profiles: users can update own (non-role)" ON public.profiles;
CREATE POLICY "profiles: users can update own (non-role)"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles: admins can update all" ON public.profiles;
CREATE POLICY "profiles: admins can update all"
  ON public.profiles FOR UPDATE
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS "profiles: service role insert" ON public.profiles;
CREATE POLICY "profiles: service role insert"
  ON public.profiles FOR INSERT
  WITH CHECK (true);  -- Trigger handles this; service role bypasses RLS anyway

-- =============================================================
-- CLIENTS
-- =============================================================
DROP POLICY IF EXISTS "clients: read by authorized roles" ON public.clients;
CREATE POLICY "clients: read by authorized roles"
  ON public.clients FOR SELECT
  USING (
    deleted_at IS NULL AND
    get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'finance')
  );

DROP POLICY IF EXISTS "clients: create by write roles" ON public.clients;
CREATE POLICY "clients: create by write roles"
  ON public.clients FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager'));

DROP POLICY IF EXISTS "clients: update by write roles" ON public.clients;
CREATE POLICY "clients: update by write roles"
  ON public.clients FOR UPDATE
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'director', 'manager'))
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager'));

DROP POLICY IF EXISTS "clients: soft-delete by admin/director" ON public.clients;
CREATE POLICY "clients: soft-delete by admin/director"
  ON public.clients FOR UPDATE
  USING (get_my_role() IN ('admin', 'director'));

-- =============================================================
-- CLIENT CONTACTS
-- =============================================================
DROP POLICY IF EXISTS "client_contacts: read with client access" ON public.client_contacts;
CREATE POLICY "client_contacts: read with client access"
  ON public.client_contacts FOR SELECT
  USING (get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'finance'));

DROP POLICY IF EXISTS "client_contacts: write by write roles" ON public.client_contacts;
CREATE POLICY "client_contacts: write by write roles"
  ON public.client_contacts FOR ALL
  USING (get_my_role() IN ('admin', 'director', 'manager'))
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager'));

-- =============================================================
-- VENDORS
-- =============================================================
DROP POLICY IF EXISTS "vendors: read by authorized roles" ON public.vendors;
CREATE POLICY "vendors: read by authorized roles"
  ON public.vendors FOR SELECT
  USING (
    deleted_at IS NULL AND
    get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'finance')
  );

DROP POLICY IF EXISTS "vendors: create by write roles" ON public.vendors;
CREATE POLICY "vendors: create by write roles"
  ON public.vendors FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager', 'account_manager'));

DROP POLICY IF EXISTS "vendors: update by write roles" ON public.vendors;
CREATE POLICY "vendors: update by write roles"
  ON public.vendors FOR UPDATE
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'director', 'manager', 'account_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager', 'account_manager'));

-- =============================================================
-- VENDOR SOCIAL PROFILES
-- =============================================================
DROP POLICY IF EXISTS "vendor_social: read by authorized roles" ON public.vendor_social_profiles;
CREATE POLICY "vendor_social: read by authorized roles"
  ON public.vendor_social_profiles FOR SELECT
  USING (get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'finance'));

DROP POLICY IF EXISTS "vendor_social: write by write roles" ON public.vendor_social_profiles;
CREATE POLICY "vendor_social: write by write roles"
  ON public.vendor_social_profiles FOR ALL
  USING (get_my_role() IN ('admin', 'director', 'manager', 'account_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager', 'account_manager'));

-- =============================================================
-- CAMPAIGNS
-- =============================================================
DROP POLICY IF EXISTS "campaigns: read by authorized roles" ON public.campaigns;
CREATE POLICY "campaigns: read by authorized roles"
  ON public.campaigns FOR SELECT
  USING (
    deleted_at IS NULL AND
    get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'finance', 'data_entry')
  );

DROP POLICY IF EXISTS "campaigns: create by write roles" ON public.campaigns;
CREATE POLICY "campaigns: create by write roles"
  ON public.campaigns FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'data_entry'));

DROP POLICY IF EXISTS "campaigns: update by write roles" ON public.campaigns;
CREATE POLICY "campaigns: update by write roles"
  ON public.campaigns FOR UPDATE
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'data_entry'))
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'data_entry'));

-- =============================================================
-- CAMPAIGN INFLUENCERS
-- =============================================================
DROP POLICY IF EXISTS "campaign_influencers: read by campaign readers" ON public.campaign_influencers;
CREATE POLICY "campaign_influencers: read by campaign readers"
  ON public.campaign_influencers FOR SELECT
  USING (get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'finance', 'data_entry'));

DROP POLICY IF EXISTS "campaign_influencers: write by write roles" ON public.campaign_influencers;
CREATE POLICY "campaign_influencers: write by write roles"
  ON public.campaign_influencers FOR ALL
  USING (get_my_role() IN ('admin', 'director', 'manager', 'account_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager', 'account_manager'));

-- =============================================================
-- DELIVERABLES
-- =============================================================
DROP POLICY IF EXISTS "deliverables: read by authorized roles" ON public.deliverables;
CREATE POLICY "deliverables: read by authorized roles"
  ON public.deliverables FOR SELECT
  USING (
    deleted_at IS NULL AND
    get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'finance', 'data_entry')
  );

DROP POLICY IF EXISTS "deliverables: write by write roles" ON public.deliverables;
CREATE POLICY "deliverables: write by write roles"
  ON public.deliverables FOR ALL
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'data_entry'))
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'data_entry'));

-- =============================================================
-- DELIVERABLE REVISIONS
-- =============================================================
DROP POLICY IF EXISTS "deliverable_revisions: read by authorized roles" ON public.deliverable_revisions;
CREATE POLICY "deliverable_revisions: read by authorized roles"
  ON public.deliverable_revisions FOR SELECT
  USING (get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'finance', 'data_entry'));

DROP POLICY IF EXISTS "deliverable_revisions: insert by write roles" ON public.deliverable_revisions;
CREATE POLICY "deliverable_revisions: insert by write roles"
  ON public.deliverable_revisions FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'data_entry'));

-- =============================================================
-- INVOICES
-- =============================================================
DROP POLICY IF EXISTS "invoices: read by finance roles" ON public.invoices;
CREATE POLICY "invoices: read by finance roles"
  ON public.invoices FOR SELECT
  USING (
    deleted_at IS NULL AND
    get_my_role() IN ('admin', 'director', 'finance', 'manager')
  );

DROP POLICY IF EXISTS "invoices: write by finance roles" ON public.invoices;
CREATE POLICY "invoices: write by finance roles"
  ON public.invoices FOR ALL
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'director', 'finance'))
  WITH CHECK (get_my_role() IN ('admin', 'director', 'finance'));

-- =============================================================
-- INVOICE LINE ITEMS
-- =============================================================
DROP POLICY IF EXISTS "invoice_line_items: read with invoice access" ON public.invoice_line_items;
CREATE POLICY "invoice_line_items: read with invoice access"
  ON public.invoice_line_items FOR SELECT
  USING (get_my_role() IN ('admin', 'director', 'finance', 'manager'));

DROP POLICY IF EXISTS "invoice_line_items: write by finance roles" ON public.invoice_line_items;
CREATE POLICY "invoice_line_items: write by finance roles"
  ON public.invoice_line_items FOR ALL
  USING (get_my_role() IN ('admin', 'director', 'finance'))
  WITH CHECK (get_my_role() IN ('admin', 'director', 'finance'));

-- =============================================================
-- PAYMENTS
-- =============================================================
DROP POLICY IF EXISTS "payments: read by finance roles" ON public.payments;
CREATE POLICY "payments: read by finance roles"
  ON public.payments FOR SELECT
  USING (
    deleted_at IS NULL AND
    get_my_role() IN ('admin', 'director', 'finance', 'manager')
  );

DROP POLICY IF EXISTS "payments: write by finance roles" ON public.payments;
CREATE POLICY "payments: write by finance roles"
  ON public.payments FOR ALL
  USING (deleted_at IS NULL AND get_my_role() IN ('admin', 'director', 'finance'))
  WITH CHECK (get_my_role() IN ('admin', 'director', 'finance'));

-- =============================================================
-- APPROVALS
-- =============================================================
DROP POLICY IF EXISTS "approvals: read by write roles" ON public.approvals;
CREATE POLICY "approvals: read by write roles"
  ON public.approvals FOR SELECT
  USING (get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'data_entry'));

DROP POLICY IF EXISTS "approvals: write by write roles" ON public.approvals;
CREATE POLICY "approvals: write by write roles"
  ON public.approvals FOR ALL
  USING (get_my_role() IN ('admin', 'director', 'manager', 'account_manager'))
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager', 'account_manager'));

-- =============================================================
-- APPROVAL COMMENTS
-- =============================================================
DROP POLICY IF EXISTS "approval_comments: read by write roles" ON public.approval_comments;
CREATE POLICY "approval_comments: read by write roles"
  ON public.approval_comments FOR SELECT
  USING (get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'data_entry'));

DROP POLICY IF EXISTS "approval_comments: insert by write roles" ON public.approval_comments;
CREATE POLICY "approval_comments: insert by write roles"
  ON public.approval_comments FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'director', 'manager', 'account_manager', 'data_entry'));

DROP POLICY IF EXISTS "approval_comments: update own" ON public.approval_comments;
CREATE POLICY "approval_comments: update own"
  ON public.approval_comments FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- =============================================================
-- AUDIT LOGS
-- =============================================================
DROP POLICY IF EXISTS "audit_logs: read by admin/director" ON public.audit_logs;
CREATE POLICY "audit_logs: read by admin/director"
  ON public.audit_logs FOR SELECT
  USING (get_my_role() IN ('admin', 'director'));

DROP POLICY IF EXISTS "audit_logs: insert by authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs: insert by authenticated"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
