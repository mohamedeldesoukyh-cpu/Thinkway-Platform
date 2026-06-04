-- =============================================================================
-- Client access management + creator portal refinements
-- =============================================================================

-- -----------------------------------------------------------------------------
-- client_users: per-entity access role
-- -----------------------------------------------------------------------------
ALTER TABLE public.client_users
  ADD COLUMN IF NOT EXISTS access_role text NOT NULL DEFAULT 'view'
    CHECK (access_role IN ('view', 'approve'));

ALTER TABLE public.client_users
  ADD COLUMN IF NOT EXISTS granted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('client_access.read', 'client_access', 'read', 'View client portal user assignments'),
  ('client_access.write', 'client_access', 'write', 'Manage client portal user assignments')
ON CONFLICT (slug) DO UPDATE
  SET
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    description = EXCLUDED.description,
    updated_at = timezone('utc', now());

WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (
       SELECT slug, id
       FROM public.permissions
       WHERE slug IN ('client_access.read', 'client_access.write')
     )
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON true
WHERE r.slug IN ('super_admin', 'admin', 'operations', 'account_manager')
ON CONFLICT DO NOTHING;

-- Client portal users: approve permission
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (
       SELECT slug, id
       FROM public.permissions
       WHERE slug = 'client_portal.approve'
     )
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON true
WHERE r.slug = 'client_user'
ON CONFLICT DO NOTHING;

-- Creator portal: vendor IO approval from portal
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (
       SELECT slug, id
       FROM public.permissions
       WHERE slug = 'creator_portal.approve'
     )
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON true
WHERE r.slug = 'influencer'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- client_users RLS: allow client_access.write
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS client_users_write ON public.client_users;
CREATE POLICY client_users_write
  ON public.client_users
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('client_access.write')
    OR (
      public.has_permission('clients.write')
      AND public.can_access_client(client_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('client_access.write')
    OR (
      public.has_permission('clients.write')
      AND public.can_access_client(client_id)
    )
  );

-- -----------------------------------------------------------------------------
-- Creator portal: reject vendor IO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_vendor_io_portal(
  p_vendor_io_id uuid,
  p_approved_by_name text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.vendor_ios%ROWTYPE;
  v_influencer_id uuid;
BEGIN
  IF NOT (public.has_permission('creator_portal.approve') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_row
  FROM public.vendor_ios
  WHERE id = p_vendor_io_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT i.id
  INTO v_influencer_id
  FROM public.influencers i
  WHERE i.id = v_row.influencer_id
    AND i.profile_id = auth.uid();

  IF v_influencer_id IS NULL THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.vendor_ios
  SET
    status = 'rejected'::public.vendor_io_status,
    approved_at = timezone('utc', now()),
    approved_by_name = COALESCE(NULLIF(p_approved_by_name, ''), 'Creator'),
    rejection_reason = NULLIF(p_rejection_reason, ''),
    updated_by = auth.uid(),
    updated_at = timezone('utc', now())
  WHERE id = p_vendor_io_id;

  INSERT INTO public.portal_notifications (
    audience_type,
    campaign_header_id,
    influencer_id,
    event_type,
    title,
    message,
    metadata
  )
  VALUES (
    'creator',
    v_row.campaign_header_id,
    v_row.influencer_id,
    'vendor_io_rejected',
    'Vendor IO rejected',
    COALESCE(NULLIF(p_rejection_reason, ''), 'Vendor IO was rejected from creator portal.'),
    jsonb_build_object('vendor_io_id', p_vendor_io_id)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_vendor_io_portal(uuid, text, text) TO authenticated;
