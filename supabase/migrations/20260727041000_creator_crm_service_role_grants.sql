-- Phase 2A soak follow-up: allow service_role REST access to CRM tables
-- (additive; authenticated grants already exist from Phase 1).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_crm_profiles TO service_role;
GRANT SELECT, INSERT ON public.creator_crm_activation_events TO service_role;
