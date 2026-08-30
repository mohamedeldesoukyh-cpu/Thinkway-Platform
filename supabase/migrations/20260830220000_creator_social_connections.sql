-- Creator Workspace Phase 4: optional creator-authorized social connections.
-- Development only (hsxrewjcbvmbkqdlzjhs). No Production migration.
-- Does not store tokens on influencer_platform_accounts or profile fields.
-- Credentials are ciphertext only; service_role reads them. Creators/Internal cannot SELECT credentials.

CREATE TABLE IF NOT EXISTS public.creator_social_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  provider text NOT NULL,
  code_challenge text,
  code_verifier_ciphertext text NOT NULL,
  redirect_to text NOT NULL DEFAULT '/creator-portal/profile',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_social_oauth_states_influencer_idx
  ON public.creator_social_oauth_states (influencer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.creator_social_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  provider text NOT NULL,
  external_account_id text NOT NULL,
  external_username text,
  external_display_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'connected', 'syncing', 'needs_attention', 'disconnected')),
  scopes text[] NOT NULL DEFAULT '{}',
  capabilities text[] NOT NULL DEFAULT '{}',
  connected_at timestamptz,
  last_synced_at timestamptz,
  disconnected_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_social_connections_active_account_uniq
  ON public.creator_social_connections (provider, external_account_id)
  WHERE disconnected_at IS NULL;

CREATE INDEX IF NOT EXISTS creator_social_connections_influencer_idx
  ON public.creator_social_connections (influencer_id, provider);

CREATE TABLE IF NOT EXISTS public.creator_social_credentials (
  connection_id uuid PRIMARY KEY REFERENCES public.creator_social_connections (id) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  token_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_social_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.creator_social_connections (id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  provider text NOT NULL,
  insight_kind text NOT NULL CHECK (insight_kind IN ('account', 'content')),
  external_content_id text NOT NULL DEFAULT '',
  canonical_url text,
  published_at timestamptz,
  content_type text,
  views bigint,
  reach bigint,
  impressions bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  engagement_rate numeric,
  followers bigint,
  captured_at timestamptz NOT NULL DEFAULT now(),
  publication_id uuid REFERENCES public.campaign_publications (id) ON DELETE SET NULL,
  match_status text NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('unmatched', 'matched', 'uncertain')),
  UNIQUE (connection_id, insight_kind, external_content_id)
);

CREATE INDEX IF NOT EXISTS creator_social_insights_publication_idx
  ON public.creator_social_insights (publication_id)
  WHERE publication_id IS NOT NULL;

ALTER TABLE public.creator_social_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_social_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_social_insights ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.creator_social_oauth_states FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.creator_social_credentials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.creator_social_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.creator_social_insights FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_social_oauth_states TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_social_credentials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_social_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_social_insights TO service_role;

GRANT SELECT ON public.creator_social_connections TO authenticated;
GRANT SELECT ON public.creator_social_insights TO authenticated;

DROP POLICY IF EXISTS creator_social_connections_select ON public.creator_social_connections;
CREATE POLICY creator_social_connections_select
  ON public.creator_social_connections
  FOR SELECT
  USING (
    influencer_id IN (
      SELECT i.id FROM public.influencers i WHERE i.profile_id = auth.uid()
    )
    OR public.has_permission('influencers.read')
    OR public.is_admin()
  );

DROP POLICY IF EXISTS creator_social_insights_select ON public.creator_social_insights;
CREATE POLICY creator_social_insights_select
  ON public.creator_social_insights
  FOR SELECT
  USING (
    influencer_id IN (
      SELECT i.id FROM public.influencers i WHERE i.profile_id = auth.uid()
    )
    OR public.has_permission('influencers.read')
    OR public.is_admin()
  );

COMMENT ON TABLE public.creator_social_credentials IS
  'Encrypted creator OAuth tokens. Service role only. Never expose to Creator or Internal clients.';
COMMENT ON TABLE public.creator_social_connections IS
  'Creator-authorized social connections. Optional. Creator Workspace works without rows here.';
