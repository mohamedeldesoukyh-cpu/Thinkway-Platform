-- Signed Client Workspace handlers authorize the token, Commercial entitlement
-- and campaign before reading the saved IO. The original IO migration granted
-- staff access only, so service_role could not perform these server-side reads.
-- Do not grant these tables to anon or change their RLS policies.
GRANT SELECT ON public.client_ios TO service_role;
GRANT SELECT ON public.io_notifications TO service_role;
