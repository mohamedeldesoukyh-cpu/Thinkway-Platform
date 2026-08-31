-- Creator Workspace invites are written with the service role (Internal users
-- have influencers.write, not settings.write). The original user_invites grants
-- were authenticated-only, which blocked Generate Creator Link.
-- Development only. Additive. Does not change RLS. Does not change Production.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invites TO service_role;
GRANT SELECT, INSERT ON public.access_logs TO service_role;
