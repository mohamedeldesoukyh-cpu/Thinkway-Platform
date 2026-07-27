-- Rollback for 20260727040000_creator_crm_profiles.sql (Phase 1).
-- Safe while feature flag is OFF and no product features depend on CRM rows.

DROP TRIGGER IF EXISTS trg_sync_has_commercial_profile ON public.creator_crm_profiles;
DROP TRIGGER IF EXISTS set_creator_crm_profiles_updated_at ON public.creator_crm_profiles;
DROP FUNCTION IF EXISTS public.sync_influencer_has_commercial_profile();
DROP TABLE IF EXISTS public.creator_crm_activation_events;
DROP TABLE IF EXISTS public.creator_crm_profiles;
DROP TYPE IF EXISTS public.creator_crm_activation_reason;
DROP TYPE IF EXISTS public.creator_crm_status;
DROP INDEX IF EXISTS public.influencers_has_commercial_profile_created_at_idx;
ALTER TABLE public.influencers DROP COLUMN IF EXISTS has_commercial_profile;
