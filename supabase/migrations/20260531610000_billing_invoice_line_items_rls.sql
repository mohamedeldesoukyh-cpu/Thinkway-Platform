-- Finance and internal billing roles must create invoice line items without
-- being the client account manager. Prior policies relied on can_access_client
-- (account manager / client portal only), which blocked invoice_line_items INSERT.

CREATE OR REPLACE FUNCTION public.can_access_client(p_client_id uuid)
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
        public.has_permission('clients.read')
        OR public.has_permission('clients.write')
        OR public.has_permission('invoices.read')
        OR public.has_permission('invoices.write')
        OR public.has_permission('payments.read')
        OR public.has_permission('payments.write')
        OR public.has_permission('campaigns.read')
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = p_client_id
        AND c.account_manager_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.client_users cu
      WHERE cu.client_id = p_client_id
        AND cu.profile_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_campaign_header(p_header_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.campaign_headers h
      WHERE h.id = p_header_id
        AND (
          h.account_manager_id = auth.uid()
          OR h.created_by = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_header_id = p_header_id
        AND cm.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaign_headers h
      JOIN public.client_users cu ON cu.client_id = h.client_id
      WHERE h.id = p_header_id AND cu.profile_id = auth.uid()
    )
    OR (
      public.is_internal_user()
      AND (
        public.has_permission('campaigns.read')
        OR public.has_permission('campaigns.write')
        OR public.has_permission('invoices.write')
      )
    )
    OR public.can_access_client(
      (SELECT client_id FROM public.campaign_headers WHERE id = p_header_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_invoice_line_items(p_invoice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = p_invoice_id
      AND public.has_permission('invoices.write')
      AND public.can_access_client(i.client_id)
  );
$$;

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
