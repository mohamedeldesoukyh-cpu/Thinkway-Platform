-- =============================================================================
-- Creator Intelligence RLS regression (SEC-003)
-- Migration: 20260726120000_creator_intelligence_rls_least_privilege
--
-- Run against Development only:
--   node scripts/_tmp_dev_psql.mjs -- supabase/tests/rls/creator_intelligence_rls_regression.sql
--
-- Expected: NOTICE "PASS: ..."; any FAIL raises.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS tw_ci_rls_test;
GRANT USAGE ON SCHEMA tw_ci_rls_test TO authenticated, service_role, PUBLIC;

CREATE OR REPLACE FUNCTION tw_ci_rls_test.fail(msg text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'FAIL: %', msg;
END;
$$;

CREATE OR REPLACE FUNCTION tw_ci_rls_test.pass(msg text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE NOTICE 'PASS: %', msg;
END;
$$;

CREATE OR REPLACE FUNCTION tw_ci_rls_test.set_auth(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION tw_ci_rls_test.clear_auth()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION tw_ci_rls_test.fail(text) TO authenticated, service_role, PUBLIC;
GRANT EXECUTE ON FUNCTION tw_ci_rls_test.pass(text) TO authenticated, service_role, PUBLIC;
GRANT EXECUTE ON FUNCTION tw_ci_rls_test.set_auth(uuid) TO authenticated, service_role, PUBLIC;
GRANT EXECUTE ON FUNCTION tw_ci_rls_test.clear_auth() TO authenticated, service_role, PUBLIC;

DO $$
DECLARE
  v_viewer_id uuid := 'aaaaaaaa-00c1-4000-8000-000000000001';
  v_portal_id uuid := 'aaaaaaaa-00c1-4000-8000-000000000002';
  v_am_id uuid := 'aaaaaaaa-00c1-4000-8000-000000000003';
  v_ops_id uuid := 'aaaaaaaa-00c1-4000-8000-000000000004';
  v_role_viewer uuid;
  v_role_client uuid;
  v_role_am uuid;
  v_role_ops uuid;
  v_snapshot_id uuid := 'cccccccc-00c1-4000-8000-000000000001';
  v_influencer_id uuid := 'bbbbbbbb-00c1-4000-8000-000000000001';
  v_ci_unified text := 'ci-rls-fixture-unified';
  v_cnt integer;
  v_force boolean;
BEGIN
  -- -------------------------------------------------------------------------
  -- Preconditions
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'can_read_creator_intelligence'
  ) THEN
    PERFORM tw_ci_rls_test.fail(
      'Migration 20260726120000_creator_intelligence_rls_least_privilege not applied'
    );
  END IF;

  SELECT id INTO v_role_viewer FROM public.roles WHERE slug = 'viewer';
  SELECT id INTO v_role_client FROM public.roles WHERE slug = 'client_user';
  SELECT id INTO v_role_am FROM public.roles WHERE slug = 'account_manager';
  SELECT id INTO v_role_ops FROM public.roles WHERE slug = 'operations';

  IF v_role_viewer IS NULL OR v_role_client IS NULL
     OR v_role_am IS NULL OR v_role_ops IS NULL THEN
    PERFORM tw_ci_rls_test.fail('Required roles missing');
  END IF;

  -- Strip discovery/intelligence perms from operations for "internal without permission"
  DELETE FROM public.role_permissions rp
  USING public.roles r, public.permissions p
  WHERE rp.role_id = r.id
    AND rp.permission_id = p.id
    AND r.slug = 'operations'
    AND p.slug IN (
      'discovery.read',
      'discovery.write',
      'discovery.admin',
      'intelligence.read'
    );

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  VALUES
    (v_viewer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ci-rls-viewer@thinkway.test', crypt('test', gen_salt('bf')),
     timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     timezone('utc', now()), timezone('utc', now())),
    (v_portal_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ci-rls-portal@thinkway.test', crypt('test', gen_salt('bf')),
     timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     timezone('utc', now()), timezone('utc', now())),
    (v_am_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ci-rls-am@thinkway.test', crypt('test', gen_salt('bf')),
     timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     timezone('utc', now()), timezone('utc', now())),
    (v_ops_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'ci-rls-ops@thinkway.test', crypt('test', gen_salt('bf')),
     timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     timezone('utc', now()), timezone('utc', now()))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, full_name, role_id, is_active)
  VALUES
    (v_viewer_id, 'ci-rls-viewer@thinkway.test', 'CI RLS Viewer', v_role_viewer, true),
    (v_portal_id, 'ci-rls-portal@thinkway.test', 'CI RLS Portal', v_role_client, true),
    (v_am_id, 'ci-rls-am@thinkway.test', 'CI RLS AM', v_role_am, true),
    (v_ops_id, 'ci-rls-ops@thinkway.test', 'CI RLS Ops No Discovery', v_role_ops, true)
  ON CONFLICT (id) DO UPDATE
    SET role_id = EXCLUDED.role_id,
        is_active = true,
        email = EXCLUDED.email;

  -- Minimal influencer + proprietary rows (superuser)
  INSERT INTO public.influencers (id, document_number, display_name, status, created_by)
  VALUES (
    v_influencer_id,
    'INF-CI-RLS-00001',
    'CI RLS Fixture Creator',
    'prospect',
    v_am_id
  )
  ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

  INSERT INTO public.ipl_snapshots (
    id, provider, platform, raw_snapshot, normalized_snapshot, is_latest
  )
  VALUES (
    v_snapshot_id,
    'ci_rls_test',
    'instagram',
    '{"secret":"raw-payload"}'::jsonb,
    '{"handle":"ci_rls_fixture"}'::jsonb,
    true
  )
  ON CONFLICT (id) DO UPDATE
    SET raw_snapshot = EXCLUDED.raw_snapshot;

  INSERT INTO public.creator_dna (influencer_id, document, version)
  VALUES (v_influencer_id, '{"identity":{"handle":{"value":"ci_rls"}}}'::jsonb, 1)
  ON CONFLICT (influencer_id) DO UPDATE
    SET document = EXCLUDED.document;

  INSERT INTO public.creator_intelligence (
    unified_id, source_type, display_name, resolved_at
  )
  VALUES (
    v_ci_unified,
    'influencer',
    'CI RLS Fixture',
    timezone('utc', now())
  )
  ON CONFLICT (unified_id) DO UPDATE
    SET display_name = EXCLUDED.display_name;

  -- FORCE RLS on all core tables
  SELECT bool_and(c.relforcerowsecurity) INTO v_force
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'creator_dna',
      'creator_dna_staging',
      'creator_dna_versions',
      'creator_dna_lineage_events',
      'creator_intelligence',
      'ipl_refresh_policies',
      'ipl_provider_runs',
      'ipl_snapshots',
      'ipl_reprocess_jobs',
      'creator_enrichment_runs',
      'influencer_metrics_history',
      'creator_content_performance_baselines'
    );

  IF v_force IS DISTINCT FROM true THEN
    PERFORM tw_ci_rls_test.fail('FORCE RLS not enabled on all CI core tables');
  END IF;
  PERFORM tw_ci_rls_test.pass('FORCE RLS enabled on CI core tables');

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'creator_dna', 'creator_intelligence', 'ipl_snapshots',
        'influencer_metrics_history', 'creator_enrichment_runs'
      )
      AND qual = 'true'
  ) THEN
    PERFORM tw_ci_rls_test.fail('Permissive USING (true) policy still present');
  END IF;
  PERFORM tw_ci_rls_test.pass('No USING (true) SELECT policies on sampled CI tables');

  -- Campaign Intelligence select policy still present (unaffected by this migration)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'campaign_intelligence_profiles'
      AND policyname = 'campaign_intelligence_profiles_select'
  ) THEN
    PERFORM tw_ci_rls_test.fail('CIP select policy missing (Campaign Intelligence regression)');
  END IF;
  PERFORM tw_ci_rls_test.pass('Campaign Intelligence profile SELECT policy present (unaffected)');

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'intelligence' AND p.proname = 'can_read_intelligence'
  ) THEN
    PERFORM tw_ci_rls_test.fail('intelligence.can_read_intelligence missing (AI Search warehouse)');
  END IF;
  PERFORM tw_ci_rls_test.pass('AI Search warehouse helper intact');

  -- -------------------------------------------------------------------------
  -- 1) Portal user denied
  -- -------------------------------------------------------------------------
  PERFORM tw_ci_rls_test.set_auth(v_portal_id);
  SET LOCAL ROLE authenticated;

  IF public.can_read_creator_intelligence() THEN
    PERFORM tw_ci_rls_test.fail('Portal can_read_creator_intelligence() true');
  END IF;

  SELECT count(*) INTO v_cnt FROM public.ipl_snapshots WHERE id = v_snapshot_id;
  IF v_cnt <> 0 THEN
    PERFORM tw_ci_rls_test.fail('Portal can SELECT ipl_snapshots');
  END IF;

  SELECT count(*) INTO v_cnt FROM public.creator_dna WHERE influencer_id = v_influencer_id;
  IF v_cnt <> 0 THEN
    PERFORM tw_ci_rls_test.fail('Portal can SELECT creator_dna');
  END IF;

  SELECT count(*) INTO v_cnt
  FROM public.creator_intelligence WHERE unified_id = v_ci_unified;
  IF v_cnt <> 0 THEN
    PERFORM tw_ci_rls_test.fail('Portal can SELECT creator_intelligence');
  END IF;

  BEGIN
    INSERT INTO public.ipl_snapshots (
      provider, platform, raw_snapshot, normalized_snapshot
    ) VALUES ('x', 'instagram', '{}'::jsonb, '{}'::jsonb);
    PERFORM tw_ci_rls_test.fail('Portal INSERT ipl_snapshots succeeded');
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL;
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%row-level security%' OR SQLERRM LIKE '%permission denied%' THEN
        NULL;
      ELSE
        RAISE;
      END IF;
  END;

  RESET ROLE;
  PERFORM tw_ci_rls_test.clear_auth();
  PERFORM tw_ci_rls_test.pass('Portal user denied CI read/write');

  -- -------------------------------------------------------------------------
  -- 2) Internal user without discovery/intelligence permission denied
  -- -------------------------------------------------------------------------
  PERFORM tw_ci_rls_test.set_auth(v_ops_id);
  SET LOCAL ROLE authenticated;

  IF public.is_internal_user() IS NOT TRUE THEN
    PERFORM tw_ci_rls_test.fail('Ops fixture is not internal');
  END IF;

  IF public.can_read_creator_intelligence() THEN
    PERFORM tw_ci_rls_test.fail('Ops without discovery perms can_read_creator_intelligence');
  END IF;

  SELECT count(*) INTO v_cnt FROM public.ipl_snapshots WHERE id = v_snapshot_id;
  IF v_cnt <> 0 THEN
    PERFORM tw_ci_rls_test.fail('Ops without discovery can SELECT ipl_snapshots');
  END IF;

  RESET ROLE;
  PERFORM tw_ci_rls_test.clear_auth();
  PERFORM tw_ci_rls_test.pass('Internal user without discovery permission denied');

  -- -------------------------------------------------------------------------
  -- 3) Internal user with discovery permission allowed (AM)
  -- -------------------------------------------------------------------------
  PERFORM tw_ci_rls_test.set_auth(v_am_id);
  SET LOCAL ROLE authenticated;

  IF NOT public.can_read_creator_intelligence() THEN
    PERFORM tw_ci_rls_test.fail('AM missing can_read_creator_intelligence');
  END IF;

  SELECT count(*) INTO v_cnt FROM public.ipl_snapshots WHERE id = v_snapshot_id;
  IF v_cnt <> 1 THEN
    PERFORM tw_ci_rls_test.fail('AM cannot SELECT ipl_snapshots');
  END IF;

  SELECT count(*) INTO v_cnt FROM public.creator_dna WHERE influencer_id = v_influencer_id;
  IF v_cnt <> 1 THEN
    PERFORM tw_ci_rls_test.fail('AM cannot SELECT creator_dna (Discovery/DNA)');
  END IF;

  SELECT count(*) INTO v_cnt
  FROM public.creator_intelligence WHERE unified_id = v_ci_unified;
  IF v_cnt < 1 THEN
    PERFORM tw_ci_rls_test.fail('AM cannot SELECT creator_intelligence (Forecast/AI projection)');
  END IF;

  -- Forecast foundation readable under same helper (may be empty)
  PERFORM 1 FROM public.influencer_metrics_history LIMIT 1;
  PERFORM 1 FROM public.creator_content_performance_baselines LIMIT 1;

  IF NOT public.can_write_creator_intelligence() THEN
    PERFORM tw_ci_rls_test.fail('AM missing can_write_creator_intelligence');
  END IF;

  UPDATE public.creator_dna
  SET document = document || jsonb_build_object('ci_rls_touch', true)
  WHERE influencer_id = v_influencer_id;

  IF NOT FOUND THEN
    PERFORM tw_ci_rls_test.fail('AM cannot UPDATE creator_dna');
  END IF;

  RESET ROLE;
  PERFORM tw_ci_rls_test.clear_auth();
  PERFORM tw_ci_rls_test.pass('Internal user with discovery permission allowed');

  -- -------------------------------------------------------------------------
  -- 4) Viewer (not internal) denied
  -- -------------------------------------------------------------------------
  PERFORM tw_ci_rls_test.set_auth(v_viewer_id);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_cnt FROM public.creator_dna WHERE influencer_id = v_influencer_id;
  IF v_cnt <> 0 THEN
    PERFORM tw_ci_rls_test.fail('Viewer can SELECT creator_dna');
  END IF;

  RESET ROLE;
  PERFORM tw_ci_rls_test.clear_auth();
  PERFORM tw_ci_rls_test.pass('Viewer denied CI data');

  -- -------------------------------------------------------------------------
  -- 5) Service role allowed (Discovery worker / enrichment path)
  -- -------------------------------------------------------------------------
  SET LOCAL ROLE service_role;

  INSERT INTO public.ipl_snapshots (
    provider, platform, raw_snapshot, normalized_snapshot, is_latest
  ) VALUES (
    'ci_rls_service',
    'tiktok',
    '{"worker":true}'::jsonb,
    '{"ok":true}'::jsonb,
    false
  );

  INSERT INTO public.influencer_metrics_history (
    influencer_id, platform, followers, source
  ) VALUES (
    v_influencer_id, 'instagram', 1000, 'ci_rls_regression'
  );

  RESET ROLE;
  PERFORM tw_ci_rls_test.pass('Service role write allowed (worker unaffected)');

  -- -------------------------------------------------------------------------
  -- Restore operations discovery grants
  -- -------------------------------------------------------------------------
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM public.roles r
  CROSS JOIN public.permissions p
  WHERE r.slug = 'operations'
    AND p.slug IN (
      'discovery.read',
      'discovery.write',
      'discovery.admin',
      'intelligence.read'
    )
  ON CONFLICT DO NOTHING;

  -- Cleanup service-role fixture rows (keep stable dna/snapshot for re-runs)
  DELETE FROM public.ipl_snapshots WHERE provider = 'ci_rls_service';
  DELETE FROM public.influencer_metrics_history WHERE source = 'ci_rls_regression';

  RAISE NOTICE 'CI RLS regression suite completed successfully.';
END;
$$;
