-- Supabase Security Advisor (splinter): resolve "Function Search Path Mutable" warnings.
--
-- Pattern matches this codebase: SET search_path = public (or intelligence, public for
-- intelligence.* SECURITY DEFINER RPCs). Safe for SECURITY DEFINER — explicit search_path
-- is required; it does not weaken definer semantics.
--
-- Static analysis of supabase/**/*.sql (Jul 2026): 132 unique signatures, 61 lacking
-- search_path in CREATE — grouped as discovery/search (26), finance/billing (13),
-- triggers/utilities (12), campaign_intelligence (6), ai (1), io/portals (2),
-- guards/audit (1). Intelligence schema functions already set in CREATE are skipped.
--
-- Dynamic sweep below fixes every public/intelligence function missing search_path at
-- apply time (covers stale overloads and any functions not captured by static grep).
-- Timestamp is after all function-defining migrations so new functions are included.
--
-- Extension-owned functions (e.g. pg_trgm's public.set_limit) are skipped: ALTER requires
-- object owner; dependencies with deptype 'e' mark extension-provided routines we must not touch.

DO $$
DECLARE
  r RECORD;
  v_search_path text;
  v_altered int := 0;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'intelligence')
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
      -- Skip functions installed by extensions (pg_trgm, etc.); not owned by the migration role.
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
      AND (
        p.proowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
        OR p.proowner = (SELECT oid FROM pg_roles WHERE rolname = 'postgres')
      )
  LOOP
    v_search_path := CASE
      WHEN r.schema_name = 'intelligence' THEN 'intelligence, public'
      ELSE 'public'
    END;

    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = %L',
      r.schema_name,
      r.function_name,
      r.args,
      v_search_path
    );
    v_altered := v_altered + 1;
  END LOOP;

  RAISE NOTICE 'fix_function_search_path_warnings: altered % function(s)', v_altered;
END;
$$;