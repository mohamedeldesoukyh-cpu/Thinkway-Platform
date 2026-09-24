-- Commercial activity must not commit without CRM membership. Application
-- activation is best-effort and can be skipped by imports, RPCs, or early returns.
-- Draft/accepted quotations alone and Discovery imports do not activate CRM.
CREATE OR REPLACE FUNCTION public.activate_creator_crm_from_commercial_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason public.creator_crm_activation_reason;
  v_source text;
BEGIN
  IF NEW.influencer_id IS NULL THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'campaign_influencers' THEN
    v_reason := 'campaign_assignment';
    v_source := 'campaign_influencer';
  ELSIF TG_TABLE_NAME = 'vendor_ios' THEN
    v_reason := 'vendor_io';
    v_source := 'vendor_io';
  ELSE
    RAISE EXCEPTION 'Unsupported CRM activation source';
  END IF;

  INSERT INTO public.creator_crm_profiles
    (influencer_id, crm_status, activated_reason, activated_by, onboarding_source)
  VALUES (NEW.influencer_id, 'incomplete', v_reason, auth.uid(), 'commercial_row_trigger')
  ON CONFLICT (influencer_id) DO NOTHING;

  -- Repair a stale denormalized flag without changing an existing lifecycle status.
  UPDATE public.influencers SET has_commercial_profile = true
  WHERE id = NEW.influencer_id AND NOT has_commercial_profile;

  INSERT INTO public.creator_crm_activation_events
    (influencer_id, reason, actor_id, source_entity_type, source_entity_id, metadata)
  VALUES (NEW.influencer_id, v_reason, auth.uid(), v_source, NEW.id,
    '{"source":"commercial_row_trigger"}'::jsonb)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_creator_crm_from_commercial_row() FROM PUBLIC;

DROP TRIGGER IF EXISTS activate_creator_crm_on_assignment ON public.campaign_influencers;
CREATE TRIGGER activate_creator_crm_on_assignment
AFTER INSERT OR UPDATE OF influencer_id ON public.campaign_influencers
FOR EACH ROW EXECUTE FUNCTION public.activate_creator_crm_from_commercial_row();

DROP TRIGGER IF EXISTS activate_creator_crm_on_vendor_io ON public.vendor_ios;
CREATE TRIGGER activate_creator_crm_on_vendor_io
AFTER INSERT OR UPDATE OF influencer_id ON public.vendor_ios
FOR EACH ROW EXECUTE FUNCTION public.activate_creator_crm_from_commercial_row();

WITH repaired AS (
  INSERT INTO public.creator_crm_profiles
    (influencer_id, crm_status, activated_reason, onboarding_source)
  SELECT i.id, 'incomplete', 'backfill', 'commercial_membership_repair_20260924'
  FROM public.influencers i
  WHERE EXISTS (SELECT 1 FROM public.campaign_influencers a WHERE a.influencer_id = i.id)
     OR EXISTS (SELECT 1 FROM public.vendor_ios v WHERE v.influencer_id = i.id)
  ON CONFLICT (influencer_id) DO NOTHING
  RETURNING influencer_id
)
INSERT INTO public.creator_crm_activation_events (influencer_id, reason, source_entity_type, metadata)
SELECT influencer_id, 'backfill', 'backfill',
  '{"source":"commercial_membership_repair_20260924"}'::jsonb
FROM repaired;

UPDATE public.influencers i SET has_commercial_profile = true
WHERE NOT i.has_commercial_profile
  AND EXISTS (SELECT 1 FROM public.creator_crm_profiles c WHERE c.influencer_id = i.id);
