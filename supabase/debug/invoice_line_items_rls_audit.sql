-- =============================================================================
-- Invoice line items RLS audit
-- Run: supabase db query --linked -f supabase/debug/invoice_line_items_rls_audit.sql
-- =============================================================================

-- 0) Rogue permissive policies (should return ZERO rows after 20260531620000 migration)
SELECT
  pol.polname AS policy_name,
  cls.relname AS table_name,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
WHERE nsp.nspname = 'public'
  AND cls.relname IN ('invoices', 'invoice_line_items')
  AND (
    pol.polname LIKE '%_policy'
    OR pg_get_expr(pol.polwithcheck, pol.polrelid) = 'true'
    OR pg_get_expr(pol.polqual, pol.polrelid) = 'true'
  )
ORDER BY cls.relname, pol.polname;

-- 0b) Profiles missing roles (common cause of line-item RLS failures)
SELECT id, email, role_id, is_active
FROM public.profiles
WHERE role_id IS NULL
ORDER BY created_at DESC;

-- 1) Active policies on invoice_line_items
SELECT
  pol.polname AS policy_name,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS command,
  pol.polpermissive AS permissive,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
WHERE nsp.nspname = 'public'
  AND cls.relname = 'invoice_line_items'
ORDER BY pol.polname;

-- 2) Active policies on invoices
SELECT
  pol.polname AS policy_name,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS command,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
FROM pg_policy pol
JOIN pg_class cls ON cls.oid = pol.polrelid
JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
WHERE nsp.nspname = 'public'
  AND cls.relname = 'invoices'
ORDER BY pol.polname;

-- 3) Helper function definitions (security + grants)
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
  pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'can_access_client',
    'can_access_campaign_header',
    'can_write_invoice_line_items',
    'has_permission',
    'is_admin',
    'is_internal_user'
  )
ORDER BY p.proname;

SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'can_access_client',
    'can_access_campaign_header',
    'can_write_invoice_line_items'
  )
ORDER BY routine_name, grantee;

-- 4) RLS enabled / forced on billing tables
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('invoices', 'invoice_line_items', 'campaign_headers', 'assignment_deliverables')
ORDER BY c.relname;

-- 5) Current session permission probe (run while authenticated as target user in SQL editor)
-- Replace :invoice_id with a real invoice UUID when testing.
/*
SELECT
  auth.uid() AS user_id,
  public.get_user_role_slug() AS role_slug,
  public.is_admin() AS is_admin,
  public.is_internal_user() AS is_internal,
  public.has_permission('invoices.read') AS has_invoices_read,
  public.has_permission('invoices.write') AS has_invoices_write,
  public.can_access_client('00000000-0000-0000-0000-000000000000'::uuid) AS can_access_dummy_client,
  public.can_write_invoice_line_items('00000000-0000-0000-0000-000000000000'::uuid) AS can_write_dummy_line;
*/

-- 6) Finance role permission check
SELECT
  r.slug AS role_slug,
  bool_or(perm.slug = 'invoices.write') AS has_invoices_write,
  bool_or(perm.slug = 'invoices.read') AS has_invoices_read,
  bool_or(perm.slug = 'clients.read') AS has_clients_read,
  bool_or(perm.slug = 'campaigns.read') AS has_campaigns_read
FROM public.roles r
JOIN public.role_permissions rp ON rp.role_id = r.id
JOIN public.permissions perm ON perm.id = rp.permission_id
WHERE r.slug IN ('finance', 'admin', 'super_admin', 'account_manager', 'operations')
GROUP BY r.slug
ORDER BY r.slug;

-- 7) Per-invoice write probe (replace invoice id)
/*
SELECT
  i.id,
  i.document_number,
  i.client_id,
  i.campaign_header_id,
  i.campaign_id,
  public.can_access_client(i.client_id) AS can_access_client,
  public.can_access_campaign_header(i.campaign_header_id) AS can_access_header,
  public.can_write_invoice_line_items(i.id) AS can_write_line_items
FROM public.invoices i
WHERE i.id = 'PASTE_INVOICE_UUID_HERE';
*/
