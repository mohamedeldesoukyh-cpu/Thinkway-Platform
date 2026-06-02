-- =============================================================================
-- Thinkway Platform — Row Level Security Policies (idempotent)
-- Safe to re-run without errors. Run AFTER schema.sql and seed.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable RLS on all application tables (idempotent)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['roles', 'permissions', 'role_permissions', 'profiles', 'clients', 'client_contacts', 'client_users', 'campaigns', 'campaign_members', 'influencers', 'influencer_platform_accounts', 'campaign_influencers', 'deliverables', 'invoices', 'invoice_line_items', 'payments', 'approvals', 'approval_steps', 'audit_logs', 'document_sequences']
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = t
        AND c.relkind IN ('r', 'p')
        AND NOT c.relrowsecurity
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- Force RLS for table owners (Supabase best practice, idempotent)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['roles', 'permissions', 'role_permissions', 'profiles', 'clients', 'client_contacts', 'client_users', 'campaigns', 'campaign_members', 'influencers', 'influencer_platform_accounts', 'campaign_influencers', 'deliverables', 'invoices', 'invoice_line_items', 'payments', 'approvals', 'approval_steps', 'audit_logs', 'document_sequences']
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = t
        AND c.relkind IN ('r', 'p')
        AND c.relrowsecurity
        AND NOT c.relforcerowsecurity
    ) THEN
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Roles & permissions (reference data)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS roles_select_authenticated ON public.roles;
CREATE POLICY roles_select_authenticated
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS roles_manage_admin ON public.roles;
CREATE POLICY roles_manage_admin
  ON public.roles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS permissions_select_authenticated ON public.permissions;
CREATE POLICY permissions_select_authenticated
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS permissions_manage_admin ON public.permissions;
CREATE POLICY permissions_manage_admin
  ON public.permissions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS role_permissions_select_authenticated ON public.role_permissions;
CREATE POLICY role_permissions_select_authenticated
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS role_permissions_manage_admin ON public.role_permissions;
CREATE POLICY role_permissions_manage_admin
  ON public.role_permissions
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_self_or_internal ON public.profiles;
CREATE POLICY profiles_select_self_or_internal
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_internal_user()
    OR public.has_permission('users.read')
  );

DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
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

DROP POLICY IF EXISTS profiles_insert_admin ON public.profiles;
CREATE POLICY profiles_insert_admin
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_permission('users.write') OR public.is_admin());

DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;
CREATE POLICY profiles_delete_admin
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- Clients
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('clients.read')
    AND public.can_access_client(id)
  );

DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('clients.write')
    AND public.is_internal_user()
  );

DROP POLICY IF EXISTS clients_update ON public.clients;
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

DROP POLICY IF EXISTS clients_delete ON public.clients;
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
DROP POLICY IF EXISTS client_contacts_select ON public.client_contacts;
CREATE POLICY client_contacts_select
  ON public.client_contacts
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('clients.read')
    AND public.can_access_client(client_id)
  );

DROP POLICY IF EXISTS client_contacts_write ON public.client_contacts;
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
DROP POLICY IF EXISTS client_users_select ON public.client_users;
CREATE POLICY client_users_select
  ON public.client_users
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR public.can_access_client(client_id)
    OR public.has_permission('users.read')
  );

DROP POLICY IF EXISTS client_users_write ON public.client_users;
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
DROP POLICY IF EXISTS campaigns_select ON public.campaigns;
CREATE POLICY campaigns_select
  ON public.campaigns
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign(id)
  );

DROP POLICY IF EXISTS campaigns_insert ON public.campaigns;
CREATE POLICY campaigns_insert
  ON public.campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.is_internal_user()
    AND public.can_access_client(client_id)
  );

DROP POLICY IF EXISTS campaigns_update ON public.campaigns;
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

DROP POLICY IF EXISTS campaigns_delete ON public.campaigns;
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
DROP POLICY IF EXISTS campaign_members_select ON public.campaign_members;
CREATE POLICY campaign_members_select
  ON public.campaign_members
  FOR SELECT
  TO authenticated
  USING (public.can_access_campaign(campaign_id));

DROP POLICY IF EXISTS campaign_members_write ON public.campaign_members;
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
DROP POLICY IF EXISTS influencers_select ON public.influencers;
CREATE POLICY influencers_select
  ON public.influencers
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('influencers.read')
    AND public.can_access_influencer(id)
  );

DROP POLICY IF EXISTS influencers_insert ON public.influencers;
CREATE POLICY influencers_insert
  ON public.influencers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('influencers.write')
    AND public.is_internal_user()
  );

DROP POLICY IF EXISTS influencers_update ON public.influencers;
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

DROP POLICY IF EXISTS influencers_delete ON public.influencers;
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
DROP POLICY IF EXISTS influencer_platform_accounts_select ON public.influencer_platform_accounts;
CREATE POLICY influencer_platform_accounts_select
  ON public.influencer_platform_accounts
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('influencers.read')
    AND public.can_access_influencer(influencer_id)
  );

DROP POLICY IF EXISTS influencer_platform_accounts_write ON public.influencer_platform_accounts;
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
DROP POLICY IF EXISTS campaign_influencers_select ON public.campaign_influencers;
CREATE POLICY campaign_influencers_select
  ON public.campaign_influencers
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign(campaign_id)
  );

DROP POLICY IF EXISTS campaign_influencers_write ON public.campaign_influencers;
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
DROP POLICY IF EXISTS deliverables_select ON public.deliverables;
CREATE POLICY deliverables_select
  ON public.deliverables
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('deliverables.read')
    AND public.can_access_campaign(campaign_id)
  );

DROP POLICY IF EXISTS deliverables_insert ON public.deliverables;
CREATE POLICY deliverables_insert
  ON public.deliverables
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('deliverables.write')
    AND public.can_access_campaign(campaign_id)
  );

DROP POLICY IF EXISTS deliverables_update ON public.deliverables;
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

DROP POLICY IF EXISTS deliverables_delete ON public.deliverables;
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
DROP POLICY IF EXISTS invoices_select ON public.invoices;
CREATE POLICY invoices_select
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_client(client_id)
    AND (
      public.has_permission('invoices.read')
      OR public.has_permission('invoices.write')
    )
  );

DROP POLICY IF EXISTS invoices_insert ON public.invoices;
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
    AND (
      campaign_header_id IS NULL
      OR public.can_access_campaign_header(campaign_header_id)
    )
  );

DROP POLICY IF EXISTS invoices_update ON public.invoices;
CREATE POLICY invoices_update
  ON public.invoices
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('invoices.write')
    AND public.can_access_client(client_id)
    AND (
      campaign_id IS NULL
      OR public.can_access_campaign(campaign_id)
    )
    AND (
      campaign_header_id IS NULL
      OR public.can_access_campaign_header(campaign_header_id)
    )
  )
  WITH CHECK (
    public.has_permission('invoices.write')
    AND public.can_access_client(client_id)
    AND (
      campaign_id IS NULL
      OR public.can_access_campaign(campaign_id)
    )
    AND (
      campaign_header_id IS NULL
      OR public.can_access_campaign_header(campaign_header_id)
    )
  );

DROP POLICY IF EXISTS invoices_delete ON public.invoices;
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
DROP POLICY IF EXISTS invoice_line_items_select ON public.invoice_line_items;
CREATE POLICY invoice_line_items_select
  ON public.invoice_line_items
  FOR SELECT
  TO authenticated
  USING (public.can_read_invoice_line_items(invoice_id));

DROP POLICY IF EXISTS invoice_line_items_write ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_insert ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_update ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_delete ON public.invoice_line_items;

CREATE POLICY invoice_line_items_insert
  ON public.invoice_line_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_write_invoice_line_items(invoice_id));

CREATE POLICY invoice_line_items_update
  ON public.invoice_line_items
  FOR UPDATE
  TO authenticated
  USING (public.can_write_invoice_line_items(invoice_id))
  WITH CHECK (public.can_write_invoice_line_items(invoice_id));

CREATE POLICY invoice_line_items_delete
  ON public.invoice_line_items
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission('invoices.delete')
    AND public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- Payments
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('payments.read')
    AND public.can_access_client(client_id)
  );

DROP POLICY IF EXISTS payments_insert ON public.payments;
CREATE POLICY payments_insert
  ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('payments.write')
    AND public.can_access_client(client_id)
  );

DROP POLICY IF EXISTS payments_update ON public.payments;
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

DROP POLICY IF EXISTS payments_delete ON public.payments;
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
DROP POLICY IF EXISTS approvals_select ON public.approvals;
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

DROP POLICY IF EXISTS approvals_insert ON public.approvals;
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

DROP POLICY IF EXISTS approvals_update ON public.approvals;
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

DROP POLICY IF EXISTS approvals_delete ON public.approvals;
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
DROP POLICY IF EXISTS approval_steps_select ON public.approval_steps;
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

DROP POLICY IF EXISTS approval_steps_write ON public.approval_steps;
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
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('audit.read')
    OR public.is_admin()
  );

DROP POLICY IF EXISTS audit_logs_insert_system ON public.audit_logs;
CREATE POLICY audit_logs_insert_system
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS audit_logs_no_update ON public.audit_logs;
CREATE POLICY audit_logs_no_update
  ON public.audit_logs
  FOR UPDATE
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS audit_logs_no_delete ON public.audit_logs;
CREATE POLICY audit_logs_no_delete
  ON public.audit_logs
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- Document sequences (internal numbering — no direct client access)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS document_sequences_deny_all ON public.document_sequences;
CREATE POLICY document_sequences_deny_all
  ON public.document_sequences
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Service role bypasses RLS; numbering runs via SECURITY DEFINER functions/triggers.
