-- =============================================================================
-- Thinkway: business function classification (OPS / Sales) on profiles
-- Separate from RBAC roles — used for revenue-by-function reporting.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_function') THEN
    CREATE TYPE public.business_function AS ENUM ('ops', 'sales');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_function public.business_function;

CREATE INDEX IF NOT EXISTS profiles_business_function_idx
  ON public.profiles (business_function)
  WHERE business_function IS NOT NULL;

ALTER TABLE public.user_invites
  ADD COLUMN IF NOT EXISTS business_function public.business_function;

COMMENT ON COLUMN public.profiles.business_function IS
  'Business function for revenue attribution: OPS or Sales. Distinct from RBAC role.';

COMMENT ON COLUMN public.user_invites.business_function IS
  'Business function to apply to profile when invite is accepted.';
