-- Release 1.2 — Enterprise Discovery Control Center (singleton settings + Apify usage).

CREATE TABLE IF NOT EXISTS public.discovery_control_settings (
  id text PRIMARY KEY DEFAULT 'default',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT discovery_control_settings_singleton_check CHECK (id = 'default')
);

CREATE TABLE IF NOT EXISTS public.discovery_apify_usage (
  usage_date date PRIMARY KEY,
  request_count integer NOT NULL DEFAULT 0,
  credits_used numeric(12, 2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT discovery_apify_usage_request_count_check CHECK (request_count >= 0),
  CONSTRAINT discovery_apify_usage_credits_check CHECK (credits_used >= 0)
);

INSERT INTO public.discovery_control_settings (id, settings)
VALUES (
  'default',
  jsonb_build_object(
    'discoverySource', 'hybrid',
    'searchPriority', 'database_first',
    'coverageThreshold', 80,
    'automaticEnrichment', 'never',
    'dnaPolicy', jsonb_build_object(
      'generateAfterImport', true,
      'updateAfterEnrichment', true,
      'calculateCompleteness', true
    ),
    'dataFreshnessDays', null,
    'costProtection', jsonb_build_object(
      'maxRequestsPerDay', 0,
      'maxCreditsPerDay', 0,
      'confirmBeforeExceed', false
    )
  )
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.discovery_control_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_apify_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discovery_control_settings_select ON public.discovery_control_settings;
CREATE POLICY discovery_control_settings_select ON public.discovery_control_settings
  FOR SELECT TO authenticated
  USING (
    public.has_permission('discovery.admin')
    OR public.has_permission('settings.write')
    OR (SELECT slug FROM public.roles r JOIN public.profiles p ON p.role_id = r.id WHERE p.id = auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS discovery_control_settings_write ON public.discovery_control_settings;
CREATE POLICY discovery_control_settings_write ON public.discovery_control_settings
  FOR ALL TO authenticated
  USING (
    public.has_permission('discovery.admin')
    OR public.has_permission('settings.write')
    OR (SELECT slug FROM public.roles r JOIN public.profiles p ON p.role_id = r.id WHERE p.id = auth.uid()) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    public.has_permission('discovery.admin')
    OR public.has_permission('settings.write')
    OR (SELECT slug FROM public.roles r JOIN public.profiles p ON p.role_id = r.id WHERE p.id = auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS discovery_apify_usage_select ON public.discovery_apify_usage;
CREATE POLICY discovery_apify_usage_select ON public.discovery_apify_usage
  FOR SELECT TO authenticated
  USING (
    public.has_permission('discovery.admin')
    OR public.has_permission('analytics.read')
    OR (SELECT slug FROM public.roles r JOIN public.profiles p ON p.role_id = r.id WHERE p.id = auth.uid()) IN ('admin', 'super_admin')
  );

DROP POLICY IF EXISTS discovery_apify_usage_write ON public.discovery_apify_usage;
CREATE POLICY discovery_apify_usage_write ON public.discovery_apify_usage
  FOR ALL TO authenticated
  USING (
    public.has_permission('discovery.admin')
    OR public.has_permission('discovery.write')
    OR public.has_permission('ai.workspace')
    OR (SELECT slug FROM public.roles r JOIN public.profiles p ON p.role_id = r.id WHERE p.id = auth.uid()) IN ('admin', 'super_admin')
  )
  WITH CHECK (
    public.has_permission('discovery.admin')
    OR public.has_permission('discovery.write')
    OR public.has_permission('ai.workspace')
    OR (SELECT slug FROM public.roles r JOIN public.profiles p ON p.role_id = r.id WHERE p.id = auth.uid()) IN ('admin', 'super_admin')
  );

GRANT SELECT, INSERT, UPDATE ON public.discovery_control_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.discovery_apify_usage TO authenticated;
GRANT ALL ON public.discovery_control_settings TO service_role;
GRANT ALL ON public.discovery_apify_usage TO service_role;

COMMENT ON TABLE public.discovery_control_settings IS
  'Release 1.2 — singleton Discovery Control Center policy (source mode, enrichment, DNA flags, cost protection).';
COMMENT ON TABLE public.discovery_apify_usage IS
  'Release 1.2 — daily Apify request/credit counters for discovery cost protection.';
