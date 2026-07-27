-- Phase 1: Creator CRM foundational schema (additive, reversible).
-- Does NOT filter Vendors UI, backfill rows, or wire workflow activation.
-- Feature flag CREATOR_CRM_FILTER_ENABLED remains OFF by default in the app.

CREATE TYPE public.creator_crm_status AS ENUM (
  'incomplete',
  'prospect',
  'negotiating',
  'active',
  'preferred',
  'inactive',
  'do_not_use'
);

CREATE TYPE public.creator_crm_activation_reason AS ENUM (
  'manual_convert',
  'manual_create',
  'campaign_assignment',
  'quotation_operational',
  'vendor_io',
  'portal_invite',
  'payment_details',
  'finance_document',
  'backfill',
  'other'
);

COMMENT ON TYPE public.creator_crm_status IS
  'Commercial Creator CRM lifecycle. Absence of creator_crm_profiles = Discovery-only / non-CRM.';

COMMENT ON TYPE public.creator_crm_activation_reason IS
  'Why ensureCommercialCreator activated a commercial profile (audit).';

CREATE TABLE public.creator_crm_profiles (
  influencer_id uuid PRIMARY KEY
    REFERENCES public.influencers (id) ON DELETE CASCADE,
  crm_status public.creator_crm_status NOT NULL DEFAULT 'incomplete',
  activated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  activated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  activated_reason public.creator_crm_activation_reason NOT NULL,
  completeness_score numeric(5, 2) NOT NULL DEFAULT 0
    CHECK (completeness_score >= 0 AND completeness_score <= 100),
  completeness_missing jsonb NOT NULL DEFAULT '[]'::jsonb,
  completeness_updated_at timestamptz,
  managed_by_agency_id uuid REFERENCES public.agencies (id) ON DELETE SET NULL,
  commercial_owner_profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  preferred_currency char(3),
  onboarding_source text,
  negotiation_notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.creator_crm_profiles IS
  'Commercial Creator CRM projection (1:1 with influencers). Sole commercial lifecycle store.';

CREATE INDEX creator_crm_profiles_status_activated_idx
  ON public.creator_crm_profiles (crm_status, activated_at DESC);

CREATE INDEX creator_crm_profiles_activated_at_idx
  ON public.creator_crm_profiles (activated_at DESC);

DROP TRIGGER IF EXISTS set_creator_crm_profiles_updated_at ON public.creator_crm_profiles;
CREATE TRIGGER set_creator_crm_profiles_updated_at
  BEFORE UPDATE ON public.creator_crm_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.creator_crm_activation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL
    REFERENCES public.influencers (id) ON DELETE CASCADE,
  reason public.creator_crm_activation_reason NOT NULL,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  source_entity_type text,
  source_entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.creator_crm_activation_events IS
  'Append-only audit of commercial CRM activations via ensureCommercialCreator.';

CREATE INDEX creator_crm_activation_events_influencer_idx
  ON public.creator_crm_activation_events (influencer_id, created_at DESC);

CREATE UNIQUE INDEX creator_crm_activation_events_source_uidx
  ON public.creator_crm_activation_events (
    influencer_id,
    reason,
    source_entity_type,
    source_entity_id
  )
  WHERE source_entity_id IS NOT NULL;

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS has_commercial_profile boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.influencers.has_commercial_profile IS
  'Denorm: true when creator_crm_profiles row exists. Maintained by trigger.';

CREATE INDEX IF NOT EXISTS influencers_has_commercial_profile_created_at_idx
  ON public.influencers (created_at DESC)
  WHERE has_commercial_profile = true;

CREATE OR REPLACE FUNCTION public.sync_influencer_has_commercial_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.influencers
    SET has_commercial_profile = true
    WHERE id = NEW.influencer_id
      AND has_commercial_profile IS DISTINCT FROM true;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.influencers
    SET has_commercial_profile = false
    WHERE id = OLD.influencer_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.creator_crm_profiles p
        WHERE p.influencer_id = OLD.influencer_id
      );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_has_commercial_profile ON public.creator_crm_profiles;
CREATE TRIGGER trg_sync_has_commercial_profile
  AFTER INSERT OR DELETE ON public.creator_crm_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_influencer_has_commercial_profile();

ALTER TABLE public.creator_crm_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_crm_activation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_crm_profiles_select ON public.creator_crm_profiles;
CREATE POLICY creator_crm_profiles_select
  ON public.creator_crm_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('influencers.read')
    AND public.can_access_influencer(influencer_id)
  );

DROP POLICY IF EXISTS creator_crm_profiles_insert ON public.creator_crm_profiles;
CREATE POLICY creator_crm_profiles_insert
  ON public.creator_crm_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('influencers.write')
    AND public.is_internal_user()
    AND public.can_access_influencer(influencer_id)
  );

DROP POLICY IF EXISTS creator_crm_profiles_update ON public.creator_crm_profiles;
CREATE POLICY creator_crm_profiles_update
  ON public.creator_crm_profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('influencers.write')
    AND public.is_internal_user()
    AND public.can_access_influencer(influencer_id)
  )
  WITH CHECK (
    public.has_permission('influencers.write')
    AND public.is_internal_user()
    AND public.can_access_influencer(influencer_id)
  );

DROP POLICY IF EXISTS creator_crm_profiles_delete ON public.creator_crm_profiles;
CREATE POLICY creator_crm_profiles_delete
  ON public.creator_crm_profiles
  FOR DELETE
  TO authenticated
  USING (
    public.has_permission('influencers.delete')
    AND public.is_admin()
  );

DROP POLICY IF EXISTS creator_crm_activation_events_select ON public.creator_crm_activation_events;
CREATE POLICY creator_crm_activation_events_select
  ON public.creator_crm_activation_events
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('influencers.read')
    AND public.can_access_influencer(influencer_id)
  );

DROP POLICY IF EXISTS creator_crm_activation_events_insert ON public.creator_crm_activation_events;
CREATE POLICY creator_crm_activation_events_insert
  ON public.creator_crm_activation_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_permission('influencers.write')
    AND public.is_internal_user()
    AND public.can_access_influencer(influencer_id)
  );

-- Append-only: no UPDATE/DELETE policies for authenticated on activation events.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_crm_profiles TO authenticated;
GRANT SELECT, INSERT ON public.creator_crm_activation_events TO authenticated;
