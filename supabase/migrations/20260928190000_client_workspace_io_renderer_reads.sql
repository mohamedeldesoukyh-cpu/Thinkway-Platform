-- Signed workspace access is checked before rendering the campaign's Client IO.
-- Server-only read dependencies of the existing staff IO renderer.
-- No data writes, public-role grants, or RLS policy changes.
GRANT SELECT ON public.client_io_assignments TO service_role;
GRANT SELECT ON public.client_io_billing_milestones TO service_role;
