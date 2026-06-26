-- PostgREST requires table-level grants even when RLS policies exist.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_publications TO authenticated, service_role;
