-- Roll back the Phase 1 application release before removing its RPC.
-- No CASCADE: unexpected dependencies must fail rather than remove unrelated objects.
BEGIN;
DROP FUNCTION IF EXISTS public.discovery_normal_candidate_window(text,integer,integer,boolean,boolean,jsonb);
DROP FUNCTION IF EXISTS public.discovery_normal_filter_candidates(jsonb,integer,integer);
COMMIT;
