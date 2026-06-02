-- =============================================================================
-- Thinkway Settings: User Management & Access Control
-- Lightweight operational workspace (non-enterprise IAM)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- User invites
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL,
  full_name text,
  role_id uuid REFERENCES public.roles (id) ON DELETE SET NULL,
  portal_type text NOT NULL DEFAULT 'internal'
    CHECK (portal_type IN ('internal', 'client', 'creator')),
  access_level text,
  department text,
  country_code char(2),
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  accepted_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS user_invites_email_idx
  ON public.user_invites (email, status);
CREATE INDEX IF NOT EXISTS user_invites_expires_at_idx
  ON public.user_invites (expires_at);

-- -----------------------------------------------------------------------------
-- Access logs (lightweight)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  target_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  action text NOT NULL,
  module text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS access_logs_actor_idx
  ON public.access_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS access_logs_target_idx
  ON public.access_logs (target_profile_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Settings permissions + matrix modules
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('settings.read', 'settings', 'read', 'View settings workspace'),
  ('settings.write', 'settings', 'write', 'Manage settings workspace'),

  ('roles.read', 'roles', 'read', 'View roles'),
  ('roles.write', 'roles', 'write', 'Create and edit roles'),

  ('access_control.read', 'access_control', 'read', 'View module access control'),
  ('access_control.write', 'access_control', 'write', 'Manage module access control'),

  ('users.invite', 'users', 'invite', 'Invite users'),

  ('ios.approve', 'ios', 'approve', 'Approve IO workflows'),
  ('ios.delete', 'ios', 'delete', 'Delete IO records'),

  ('publications.read', 'publications', 'read', 'View publications'),
  ('publications.write', 'publications', 'write', 'Manage publications'),
  ('publications.approve', 'publications', 'approve', 'Approve publications'),
  ('publications.delete', 'publications', 'delete', 'Delete publications'),

  ('client_portal.read', 'client_portal', 'read', 'Access client portal'),
  ('client_portal.write', 'client_portal', 'write', 'Operate in client portal'),
  ('client_portal.approve', 'client_portal', 'approve', 'Approve client portal items'),
  ('client_portal.delete', 'client_portal', 'delete', 'Delete client portal items'),

  ('creator_portal.read', 'creator_portal', 'read', 'Access creator portal'),
  ('creator_portal.write', 'creator_portal', 'write', 'Operate in creator portal'),
  ('creator_portal.approve', 'creator_portal', 'approve', 'Approve creator portal items'),
  ('creator_portal.delete', 'creator_portal', 'delete', 'Delete creator portal items')
ON CONFLICT (slug) DO UPDATE
  SET
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    description = EXCLUDED.description,
    updated_at = timezone('utc', now());

-- Admins manage settings
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (
       SELECT slug, id
       FROM public.permissions
       WHERE slug IN (
         'settings.read', 'settings.write',
         'roles.read', 'roles.write',
         'access_control.read', 'access_control.write',
         'users.read', 'users.write', 'users.invite'
       )
     )
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON true
WHERE r.slug IN ('super_admin', 'admin')
ON CONFLICT DO NOTHING;

-- Internal teams: read settings and users
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (
       SELECT slug, id
       FROM public.permissions
       WHERE slug IN ('settings.read', 'users.read')
     )
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON true
WHERE r.slug IN ('finance', 'operations', 'account_manager')
ON CONFLICT DO NOTHING;

-- Portal isolation defaults
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (
       SELECT slug, id
       FROM public.permissions
       WHERE slug IN ('client_portal.read', 'client_portal.write')
     )
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON true
WHERE r.slug = 'client_user'
ON CONFLICT DO NOTHING;

WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (
       SELECT slug, id
       FROM public.permissions
       WHERE slug IN ('creator_portal.read', 'creator_portal.write')
     )
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON true
WHERE r.slug = 'influencer'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_user_invites_updated_at ON public.user_invites;
CREATE TRIGGER set_user_invites_updated_at
  BEFORE UPDATE ON public.user_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invites FORCE ROW LEVEL SECURITY;

ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_invites_select ON public.user_invites;
CREATE POLICY user_invites_select ON public.user_invites
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('settings.read')
  );

DROP POLICY IF EXISTS user_invites_write ON public.user_invites;
CREATE POLICY user_invites_write ON public.user_invites
  FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('settings.write')
    OR public.has_permission('users.invite')
  )
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('settings.write')
    OR public.has_permission('users.invite')
  );

DROP POLICY IF EXISTS access_logs_select ON public.access_logs;
CREATE POLICY access_logs_select ON public.access_logs
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.has_permission('settings.read')
    OR public.has_permission('audit.read')
  );

DROP POLICY IF EXISTS access_logs_write ON public.access_logs;
CREATE POLICY access_logs_write ON public.access_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.has_permission('settings.write')
  );

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invites TO authenticated;
GRANT SELECT, INSERT ON public.access_logs TO authenticated;
