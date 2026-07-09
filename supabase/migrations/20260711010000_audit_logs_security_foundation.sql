-- =============================================================================
-- Phase 0.1 Security Foundation: audit_logs hardening
-- Table + base RLS exist in schema.sql / policies.sql — extend, do not recreate.
-- =============================================================================

INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('audit.write', 'audit', 'write', 'Write audit log entries')
ON CONFLICT (slug) DO UPDATE
  SET
    resource = EXCLUDED.resource,
    action = EXCLUDED.action,
    description = EXCLUDED.description,
    updated_at = timezone('utc', now());

WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (SELECT slug, id FROM public.permissions WHERE slug = 'audit.write')
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON true
WHERE r.slug IN (
  'super_admin', 'admin', 'finance', 'operations',
  'account_manager', 'viewer', 'client_user', 'influencer'
)
ON CONFLICT DO NOTHING;

-- Allow internal users to append their own audit entries (actor_id = auth.uid()).
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert_system ON public.audit_logs;
CREATE POLICY audit_logs_insert_system ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      public.is_admin()
      OR public.is_internal_user()
      OR public.has_permission('audit.write')
    )
  );

COMMENT ON TABLE public.audit_logs IS
  'Immutable security and operational audit trail. Phase 0.1 hardens insert policy for internal users.';
