-- Supabase Security Advisor (thinkway-dev): resolve 4 errors only.
--
-- 1–3) public.campaigns, invoice_lines, campaign_bootstrap_shell_lines
--      Views default to SECURITY DEFINER (owner privileges), which bypasses
--      caller RLS on underlying tables. Set security_invoker so row access
--      is evaluated as the querying role (authenticated / service_role).
--
-- 4) public.md_platform_deliverable_types
--      Reference/lookup table in public schema without RLS. Enable RLS with
--      read-only policy for authenticated users (same pattern as md_* tables).

ALTER VIEW public.campaigns SET (security_invoker = true);
ALTER VIEW public.invoice_lines SET (security_invoker = true);
ALTER VIEW public.campaign_bootstrap_shell_lines SET (security_invoker = true);

ALTER TABLE public.md_platform_deliverable_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS md_platform_deliverable_types_select ON public.md_platform_deliverable_types;
CREATE POLICY md_platform_deliverable_types_select
  ON public.md_platform_deliverable_types
  FOR SELECT
  TO authenticated
  USING (true);
