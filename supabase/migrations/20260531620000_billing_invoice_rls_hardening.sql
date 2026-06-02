-- Harden invoice RLS after audit:
-- 1) Remove dashboard-created permissive invoice policies that bypass finance checks
-- 2) Strengthen line-item helpers (admin bypass, explicit grants)
-- 3) Align invoice_line_items SELECT with write path

-- Rogue policies (not in repo) allowed invoice header INSERT with WITH CHECK true
-- while invoice_line_items still required invoices.write via can_write_invoice_line_items().
DROP POLICY IF EXISTS invoices_insert_policy ON public.invoices;
DROP POLICY IF EXISTS invoices_select_policy ON public.invoices;
DROP POLICY IF EXISTS invoices_update_policy ON public.invoices;
DROP POLICY IF EXISTS invoice_line_items_insert_policy ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_select_policy ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_update_policy ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_all_policy ON public.invoice_line_items;

CREATE OR REPLACE FUNCTION public.can_write_invoice_line_items(p_invoice_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF p_invoice_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT (
    public.is_admin()
    OR public.has_permission('invoices.write')
  ) THEN
    RETURN false;
  END IF;

  SELECT i.client_id
  INTO v_client_id
  FROM public.invoices i
  WHERE i.id = p_invoice_id;

  IF v_client_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.can_access_client(v_client_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_invoice_line_items(p_invoice_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF p_invoice_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT (
    public.is_admin()
    OR public.has_permission('invoices.read')
    OR public.has_permission('invoices.write')
  ) THEN
    RETURN false;
  END IF;

  SELECT i.client_id
  INTO v_client_id
  FROM public.invoices i
  WHERE i.id = p_invoice_id;

  IF v_client_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.can_access_client(v_client_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_write_invoice_line_items(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_invoice_line_items(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_client(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_campaign_header(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS invoice_line_items_select ON public.invoice_line_items;
CREATE POLICY invoice_line_items_select
  ON public.invoice_line_items
  FOR SELECT
  TO authenticated
  USING (public.can_read_invoice_line_items(invoice_id));

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
