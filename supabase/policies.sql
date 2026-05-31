-- =============================================================================
-- Thinkway Platform — Row Level Security Policies
-- Run AFTER schema.sql and seed.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable RLS on all application tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners (Supabase best practice)
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.influencers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_platform_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_influencers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approvals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Roles & permissions (reference data)
-- -----------------------------------------------------------------------------
CREATE POLICY roles_select_authenticated
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY roles_manage_admin
  ON public.roles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY permissions_select_authenticated
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY permissions_manage_admin
  ON public.permissions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY role_permissions_select_authenticated
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY role_permissions_manage_admin
  ON public.role_permissions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
CREATE POLICY profiles_select_self_or_internal
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_internal_user()
    OR public.has_permission('users.read')
  );

CREATE POLICY profiles_update_self_or_admin
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR public.has_permission('users.write')
    OR public.is_admin()
  )
  WITH CHECK (
    id = auth.uid()
    OR public.has_permission('users.write')
    OR public.is_admin()
  );

CREATE POLICY profiles_insert_admin
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('users.write') OR public.is_admin());

CREATE POLICY profiles_delete_admin
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- Clients
-- -----------------------------------------------------------------------------
CREATE POLICY clients_select
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('clients.read')
    AND public.can_access_client(id)
  );

CREATE POLICY clients_insert
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('clients.write')
    AND public.is_internal_user()
  );

CREATE POLICY clients_update
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('clients.write')
    AND public.can_access_client(id)
  )
  WITH CHECK (
    public.has_permission('clients.write')
    AND public.can_access_client(id)
  );

CREATE POLICY clients_delete
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission('clients.delete')
    AND public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- Client contacts
-- -----------------------------------------------------------------------------
CREATE POLICY client_contacts_select
  ON public.client_contacts
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('clients.read')
    AND public.can_access_client(client_id)
  );

CREATE POLICY client_contacts_write
  ON public.client_contacts
  FOR ALL
  TO authenticated
  USING (
    public.has_permission('clients.write')
    AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.has_permission('clients.write')
    AND public.can_access_client(client_id)
  );

-- -----------------------------------------------------------------------------
-- Client users (portal assignments)
-- -----------------------------------------------------------------------------
CREATE POLICY client_users_select
  ON public.client_users
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.can_access_client(client_id)
    OR public.has_permission('users.read')
  );

CREATE POLICY client_users_write
  ON public.client_users
  FOR ALL
  TO authenticated
  USING (
    public.has_permission('clients.write')
    AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.has_permission('clients.write')
    AND public.can_access_client(client_id)
  );

-- -----------------------------------------------------------------------------
-- Campaigns
-- -----------------------------------------------------------------------------
CREATE POLICY campaigns_select
  ON public.campaigns
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign(id)
  );

CREATE POLICY campaigns_insert
  ON public.campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.is_internal_user()
    AND public.can_access_client(client_id)
  );

CREATE POLICY campaigns_update
  ON public.campaigns
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign(id)
  )
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign(id)
  );

CREATE POLICY campaigns_delete
  ON public.campaigns
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission('campaigns.delete')
    AND (public.is_admin() OR account_manager_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- Campaign members
-- -----------------------------------------------------------------------------
CREATE POLICY campaign_members_select
  ON public.campaign_members
  FOR SELECT
  TO authenticated
  USING (public.can_access_campaign(campaign_id));

CREATE POLICY campaign_members_write
  ON public.campaign_members
  FOR ALL
  TO authenticated
  USING (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign(campaign_id)
  )
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign(campaign_id)
  );

-- -----------------------------------------------------------------------------
-- Influencers
-- -----------------------------------------------------------------------------
CREATE POLICY influencers_select
  ON public.influencers
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('influencers.read')
    AND public.can_access_influencer(id)
  );

CREATE POLICY influencers_insert
  ON public.influencers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('influencers.write')
    AND public.is_internal_user()
  );

CREATE POLICY influencers_update
  ON public.influencers
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('influencers.write')
    AND public.can_access_influencer(id)
  )
  WITH CHECK (
    public.has_permission('influencers.write')
    AND public.can_access_influencer(id)
  );

CREATE POLICY influencers_delete
  ON public.influencers
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission('influencers.delete')
    AND public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- Influencer platform accounts
-- -----------------------------------------------------------------------------
CREATE POLICY influencer_platform_accounts_select
  ON public.influencer_platform_accounts
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('influencers.read')
    AND public.can_access_influencer(influencer_id)
  );

CREATE POLICY influencer_platform_accounts_write
  ON public.influencer_platform_accounts
  FOR ALL
  TO authenticated
  USING (
    public.has_permission('influencers.write')
    AND public.can_access_influencer(influencer_id)
  )
  WITH CHECK (
    public.has_permission('influencers.write')
    AND public.can_access_influencer(influencer_id)
  );

-- -----------------------------------------------------------------------------
-- Campaign influencers
-- -----------------------------------------------------------------------------
CREATE POLICY campaign_influencers_select
  ON public.campaign_influencers
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign(campaign_id)
  );

CREATE POLICY campaign_influencers_write
  ON public.campaign_influencers
  FOR ALL
  TO authenticated
  USING (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign(campaign_id)
  )
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign(campaign_id)
  );

-- -----------------------------------------------------------------------------
-- Deliverables
-- -----------------------------------------------------------------------------
CREATE POLICY deliverables_select
  ON public.deliverables
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('deliverables.read')
    AND public.can_access_campaign(campaign_id)
  );

CREATE POLICY deliverables_insert
  ON public.deliverables
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('deliverables.write')
    AND public.can_access_campaign(campaign_id)
  );

CREATE POLICY deliverables_update
  ON public.deliverables
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('deliverables.write')
    AND public.can_access_campaign(campaign_id)
  )
  WITH CHECK (
    public.has_permission('deliverables.write')
    AND public.can_access_campaign(campaign_id)
  );

CREATE POLICY deliverables_delete
  ON public.deliverables
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission('deliverables.delete')
    AND public.is_internal_user()
    AND public.can_access_campaign(campaign_id)
  );

-- -----------------------------------------------------------------------------
-- Invoices
-- -----------------------------------------------------------------------------
CREATE POLICY invoices_select
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('invoices.read')
    AND public.can_access_client(client_id)
  );

CREATE POLICY invoices_insert
  ON public.invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('invoices.write')
    AND public.can_access_client(client_id)
    AND (
      campaign_id IS NULL
      OR public.can_access_campaign(campaign_id)
    )
  );

CREATE POLICY invoices_update
  ON public.invoices
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('invoices.write')
    AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.has_permission('invoices.write')
    AND public.can_access_client(client_id)
  );

CREATE POLICY invoices_delete
  ON public.invoices
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission('invoices.delete')
    AND public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- Invoice line items
-- -----------------------------------------------------------------------------
CREATE POLICY invoice_line_items_select
  ON public.invoice_line_items
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('invoices.read')
    AND EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND public.can_access_client(i.client_id)
    )
  );

CREATE POLICY invoice_line_items_write
  ON public.invoice_line_items
  FOR ALL
  TO authenticated
  USING (
    public.has_permission('invoices.write')
    AND EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND public.can_access_client(i.client_id)
    )
  )
  WITH CHECK (
    public.has_permission('invoices.write')
    AND EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_id
        AND public.can_access_client(i.client_id)
    )
  );

-- -----------------------------------------------------------------------------
-- Payments
-- -----------------------------------------------------------------------------
CREATE POLICY payments_select
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('payments.read')
    AND public.can_access_client(client_id)
  );

CREATE POLICY payments_insert
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('payments.write')
    AND public.can_access_client(client_id)
  );

CREATE POLICY payments_update
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('payments.write')
    AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.has_permission('payments.write')
    AND public.can_access_client(client_id)
  );

CREATE POLICY payments_delete
  ON public.payments
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission('payments.delete')
    AND public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- Approvals
-- -----------------------------------------------------------------------------
CREATE POLICY approvals_select
  ON public.approvals
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('approvals.read')
    AND (
      requested_by = auth.uid()
      OR assigned_to = auth.uid()
      OR public.is_internal_user()
    )
  );

CREATE POLICY approvals_insert
  ON public.approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('approvals.write')
    AND (
      requested_by = auth.uid()
      OR public.is_internal_user()
    )
  );

CREATE POLICY approvals_update
  ON public.approvals
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('approvals.write')
    AND (
      assigned_to = auth.uid()
      OR requested_by = auth.uid()
      OR public.is_admin()
      OR public.has_permission('approvals.decide')
    )
  )
  WITH CHECK (
    public.has_permission('approvals.write')
    AND (
      assigned_to = auth.uid()
      OR requested_by = auth.uid()
      OR public.is_admin()
      OR public.has_permission('approvals.decide')
    )
  );

CREATE POLICY approvals_delete
  ON public.approvals
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission('approvals.delete')
    AND public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- Approval steps
-- -----------------------------------------------------------------------------
CREATE POLICY approval_steps_select
  ON public.approval_steps
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('approvals.read')
    AND EXISTS (
      SELECT 1
      FROM public.approvals a
      WHERE a.id = approval_id
        AND (
          a.requested_by = auth.uid()
          OR a.assigned_to = auth.uid()
          OR approver_id = auth.uid()
          OR public.is_internal_user()
        )
    )
  );

CREATE POLICY approval_steps_write
  ON public.approval_steps
  FOR ALL
  TO authenticated
  USING (
    public.has_permission('approvals.write')
    AND (
      approver_id = auth.uid()
      OR public.is_admin()
      OR public.has_permission('approvals.decide')
    )
  )
  WITH CHECK (
    public.has_permission('approvals.write')
    AND (
      approver_id = auth.uid()
      OR public.is_admin()
      OR public.has_permission('approvals.decide')
    )
  );

-- -----------------------------------------------------------------------------
-- Audit logs (read-only for privileged users)
-- -----------------------------------------------------------------------------
CREATE POLICY audit_logs_select
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('audit.read')
    OR public.is_admin()
  );

CREATE POLICY audit_logs_insert_system
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY audit_logs_no_update
  ON public.audit_logs
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY audit_logs_no_delete
  ON public.audit_logs
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- Document sequences (internal numbering — no direct client access)
-- -----------------------------------------------------------------------------
CREATE POLICY document_sequences_deny_all
  ON public.document_sequences
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Service role bypasses RLS; numbering runs via SECURITY DEFINER functions/triggers.
