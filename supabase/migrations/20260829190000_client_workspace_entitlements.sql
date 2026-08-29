-- Client Workspace entitlements on the legal entity, plus access requests
-- and a 14-day Live Performance preview. Development first.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_workspace_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_workspace_package text
    CHECK (client_workspace_package IS NULL OR client_workspace_package IN ('planning', 'commercial', 'live'));

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_workspace_tab_overrides jsonb;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_workspace_grandfathered boolean NOT NULL DEFAULT false;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_workspace_preview_started_at timestamptz;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_workspace_preview_expires_at timestamptz;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_workspace_preview_previous_package text
    CHECK (
      client_workspace_preview_previous_package IS NULL
      OR client_workspace_preview_previous_package IN ('planning', 'commercial', 'live')
    );

COMMENT ON COLUMN public.clients.client_workspace_enabled IS
  'Legal-entity Client Workspace service. Off means review links show a closed-service state.';
COMMENT ON COLUMN public.clients.client_workspace_package IS
  'Planning, Commercial, or Live Performance. Null when Client Workspace is Off.';
COMMENT ON COLUMN public.clients.client_workspace_tab_overrides IS
  'Optional per-tab open/locked map. Package remains the default entitlement.';
COMMENT ON COLUMN public.clients.client_workspace_grandfathered IS
  'True when existing reviews were backfilled to Live Performance. Not a billing flag.';

UPDATE public.clients AS c
SET
  client_workspace_enabled = true,
  client_workspace_package = 'live',
  client_workspace_grandfathered = true
WHERE EXISTS (
  SELECT 1
  FROM public.campaign_client_reviews r
  LEFT JOIN public.campaign_headers h ON h.id = r.campaign_header_id
  LEFT JOIN public.discovery_shortlists s ON s.id = r.shortlist_id
  LEFT JOIN public.quotations q ON q.id = r.quotation_id
  WHERE h.client_id = c.id
     OR s.client_id = c.id
     OR q.client_id = c.id
);

CREATE TABLE IF NOT EXISTS public.client_workspace_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  review_id uuid NOT NULL REFERENCES public.campaign_client_reviews (id) ON DELETE CASCADE,
  section_id text NOT NULL
    CHECK (section_id IN ('shortlist', 'creators', 'commercial', 'approval', 'overview')),
  requested_package text NOT NULL
    CHECK (requested_package IN ('planning', 'commercial', 'live')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS client_workspace_access_requests_pending_uniq
  ON public.client_workspace_access_requests (review_id, section_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS client_workspace_access_requests_client_idx
  ON public.client_workspace_access_requests (client_id, status, created_at DESC);

COMMENT ON TABLE public.client_workspace_access_requests IS
  'Client Request access from a locked Client Workspace tab. Does not change entitlement or bill.';

ALTER TABLE public.client_workspace_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_workspace_access_requests FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.client_workspace_access_requests FROM anon;
GRANT SELECT, UPDATE ON TABLE public.client_workspace_access_requests TO authenticated;

DROP POLICY IF EXISTS client_workspace_access_requests_select ON public.client_workspace_access_requests;
CREATE POLICY client_workspace_access_requests_select
  ON public.client_workspace_access_requests
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('clients.read')
    AND public.can_access_client(client_id)
  );

DROP POLICY IF EXISTS client_workspace_access_requests_update ON public.client_workspace_access_requests;
CREATE POLICY client_workspace_access_requests_update
  ON public.client_workspace_access_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('clients.write')
    AND public.can_access_client(client_id)
  )
  WITH CHECK (
    public.has_permission('clients.write')
    AND public.can_access_client(client_id)
  );

GRANT SELECT, INSERT, UPDATE ON public.client_workspace_access_requests TO service_role;
