-- Fix Production Add-creators / Discovery search statement timeouts.
--
-- Root cause (reproduced on Production ienowhwfyxoqtzbgltno):
--   search_creators + creator_search_candidate_keys run as SECURITY INVOKER.
--   influencers has FORCE ROW LEVEL SECURITY. Under authenticated, a simple
--   COUNT of active influencers takes ~7s; the multi-UNION search exceeds the
--   PostgREST ~8s statement_timeout:
--     Error: canceling statement due to statement timeout
--     CONTEXT: has_permission → can_read_all_influencers → creator_search_candidate_keys
--
-- Same class as vendors-list RLS hotfix. postgres owns these functions and has
-- BYPASSRLS, so SECURITY DEFINER avoids per-row FORCE RLS cost. Permission gate
-- keeps least privilege for the public RPC entrypoint.

ALTER FUNCTION public.creator_search_candidate_keys(text) SECURITY DEFINER;
ALTER FUNCTION public.creator_search_candidate_keys(text) SET search_path = public;

ALTER FUNCTION public.search_creators(text, integer, integer) RENAME TO search_creators_impl;

ALTER FUNCTION public.search_creators_impl(text, integer, integer) SECURITY DEFINER;
ALTER FUNCTION public.search_creators_impl(text, integer, integer) SET search_path = public;

REVOKE ALL ON FUNCTION public.search_creators_impl(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_creators_impl(text, integer, integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.search_creators_impl(text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_creators_impl(text, integer, integer) TO service_role;

-- Internal helper may still be called from other DEFINER SQL; keep authenticated
-- off the direct candidate-keys entry so search goes through the gated RPC.
REVOKE ALL ON FUNCTION public.creator_search_candidate_keys(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.creator_search_candidate_keys(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.creator_search_candidate_keys(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.creator_search_candidate_keys(text) TO service_role;

CREATE OR REPLACE FUNCTION public.search_creators(
  p_query text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  source_type text,
  creator_id uuid,
  rank real,
  has_more boolean,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_permission('discovery.read')
    OR public.has_permission('influencers.read')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions for creator search'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.search_creators_impl(p_query, p_limit, p_offset);
END;
$$;

COMMENT ON FUNCTION public.search_creators(text, integer, integer) IS
  'Unified creator search RPC. SECURITY DEFINER (BYPASSRLS) with discovery.read / influencers.read gate to avoid FORCE RLS timeouts.';

GRANT EXECUTE ON FUNCTION public.search_creators(text, integer, integer) TO authenticated, service_role;

-- Legacy count RPC also called candidate_keys under INVOKER RLS.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'search_creators_count'
      AND pg_get_function_identity_arguments(p.oid) = 'p_query text'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.search_creators_count(text) SECURITY DEFINER';
    EXECUTE 'ALTER FUNCTION public.search_creators_count(text) SET search_path = public';
  END IF;
END $$;
