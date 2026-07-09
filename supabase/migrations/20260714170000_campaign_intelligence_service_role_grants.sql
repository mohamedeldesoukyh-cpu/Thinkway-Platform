-- Service role needs table grants for server-side brief save (elevated write path).
-- Original CIP migration only granted authenticated; admin client uses service_role.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_intelligence_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_intelligence_documents TO service_role;
