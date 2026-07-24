-- =============================================================================
-- P0 Finance / FX RLS regression tests
-- Source: docs/security/authentication-audit.md (P0-01, P0-02)
--
-- Run (local):
--   supabase db reset   -- applies migrations including 20260724150000
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls/finance_fx_p0_regression.sql
--
-- Or:
--   supabase db query --local -f supabase/tests/rls/finance_fx_p0_regression.sql
--
-- Expected: script completes with NOTICE lines "PASS: ..."; any FAIL raises.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS tw_p0_finance_fx_test;
GRANT USAGE ON SCHEMA tw_p0_finance_fx_test TO authenticated, service_role, PUBLIC;

CREATE OR REPLACE FUNCTION tw_p0_finance_fx_test.fail(msg text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'FAIL: %', msg;
END;
$$;

CREATE OR REPLACE FUNCTION tw_p0_finance_fx_test.pass(msg text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE NOTICE 'PASS: %', msg;
END;
$$;

CREATE OR REPLACE FUNCTION tw_p0_finance_fx_test.set_auth(p_user_id uuid)
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

CREATE OR REPLACE FUNCTION tw_p0_finance_fx_test.clear_auth()
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

GRANT EXECUTE ON FUNCTION tw_p0_finance_fx_test.fail(text) TO authenticated, service_role, PUBLIC;
GRANT EXECUTE ON FUNCTION tw_p0_finance_fx_test.pass(text) TO authenticated, service_role, PUBLIC;
GRANT EXECUTE ON FUNCTION tw_p0_finance_fx_test.set_auth(uuid) TO authenticated, service_role, PUBLIC;
GRANT EXECUTE ON FUNCTION tw_p0_finance_fx_test.clear_auth() TO authenticated, service_role, PUBLIC;

DO $$
DECLARE
  v_viewer_id uuid := 'aaaaaaaa-0001-4000-8000-000000000001';
  v_client_portal_id uuid := 'aaaaaaaa-0002-4000-8000-000000000002';
  v_finance_id uuid := 'aaaaaaaa-0003-4000-8000-000000000003';
  v_admin_id uuid := 'aaaaaaaa-0004-4000-8000-000000000004';
  v_ops_no_override_id uuid := 'aaaaaaaa-0005-4000-8000-000000000005';
  v_client_id uuid;
  v_doc_id uuid;
  v_rate_id uuid;
  v_cnt integer;
  v_role_viewer uuid;
  v_role_client uuid;
  v_role_finance uuid;
  v_role_admin uuid;
  v_role_ops uuid;
BEGIN
  -- -------------------------------------------------------------------------
  -- Preconditions
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'can_read_finance_control'
  ) THEN
    PERFORM tw_p0_finance_fx_test.fail(
      'Migration 20260724150000_finance_fx_rls_least_privilege not applied'
    );
  END IF;

  SELECT id INTO v_role_viewer FROM public.roles WHERE slug = 'viewer';
  SELECT id INTO v_role_client FROM public.roles WHERE slug = 'client_user';
  SELECT id INTO v_role_finance FROM public.roles WHERE slug = 'finance';
  SELECT id INTO v_role_admin FROM public.roles WHERE slug = 'admin';
  SELECT id INTO v_role_ops FROM public.roles WHERE slug = 'operations';

  IF v_role_viewer IS NULL OR v_role_client IS NULL OR v_role_finance IS NULL
     OR v_role_admin IS NULL OR v_role_ops IS NULL THEN
    PERFORM tw_p0_finance_fx_test.fail('Required roles missing from public.roles');
  END IF;

  -- Ensure permissions exist and are granted
  IF NOT EXISTS (SELECT 1 FROM public.permissions WHERE slug = 'finance.read')
     OR NOT EXISTS (SELECT 1 FROM public.permissions WHERE slug = 'finance.write')
     OR NOT EXISTS (SELECT 1 FROM public.permissions WHERE slug = 'finance.override') THEN
    PERFORM tw_p0_finance_fx_test.fail('finance.read/write/override permissions missing');
  END IF;

  -- Strip finance.override from operations for FX-write denial case (session-local fixture).
  -- Restored at end of DO block via re-insert.
  DELETE FROM public.role_permissions rp
  USING public.roles r, public.permissions p
  WHERE rp.role_id = r.id
    AND rp.permission_id = p.id
    AND r.slug = 'operations'
    AND p.slug = 'finance.override';

  -- -------------------------------------------------------------------------
  -- Fixture auth users + profiles (idempotent)
  -- -------------------------------------------------------------------------
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  VALUES
    (v_viewer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'p0-viewer@thinkway.test', crypt('test', gen_salt('bf')),
     timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     timezone('utc', now()), timezone('utc', now())),
    (v_client_portal_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'p0-client@thinkway.test', crypt('test', gen_salt('bf')),
     timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     timezone('utc', now()), timezone('utc', now())),
    (v_finance_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'p0-finance@thinkway.test', crypt('test', gen_salt('bf')),
     timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     timezone('utc', now()), timezone('utc', now())),
    (v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'p0-admin@thinkway.test', crypt('test', gen_salt('bf')),
     timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     timezone('utc', now()), timezone('utc', now())),
    (v_ops_no_override_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'p0-ops@thinkway.test', crypt('test', gen_salt('bf')),
     timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
     timezone('utc', now()), timezone('utc', now()))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, full_name, role_id, is_active)
  VALUES
    (v_viewer_id, 'p0-viewer@thinkway.test', 'P0 Viewer', v_role_viewer, true),
    (v_client_portal_id, 'p0-client@thinkway.test', 'P0 Client Portal', v_role_client, true),
    (v_finance_id, 'p0-finance@thinkway.test', 'P0 Finance', v_role_finance, true),
    (v_admin_id, 'p0-admin@thinkway.test', 'P0 Admin', v_role_admin, true),
    (v_ops_no_override_id, 'p0-ops@thinkway.test', 'P0 Ops No Override', v_role_ops, true)
  ON CONFLICT (id) DO UPDATE
    SET role_id = EXCLUDED.role_id,
        is_active = true,
        email = EXCLUDED.email;

  -- Seed client + finance document as superuser (bypasses RLS; FORCE does not apply to superuser)
  INSERT INTO public.clients (id, document_number, name, legal_name, status)
  VALUES (
    'bbbbbbbb-0001-4000-8000-000000000001',
    'CLT-P0-REGRESSION-00001',
    'P0 Finance Client',
    'P0 Finance Client LLC',
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_client_id;

  IF v_client_id IS NULL THEN
    v_client_id := 'bbbbbbbb-0001-4000-8000-000000000001';
  END IF;

  INSERT INTO public.client_users (client_id, profile_id, access_role, is_primary)
  VALUES (v_client_id, v_client_portal_id, 'view', true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.finance_documents (
    id, document_kind, document_number, source_table, source_id,
    client_id, currency, amount_before_vat, vat_amount, amount_after_vat, status
  )
  VALUES (
    'cccccccc-0001-4000-8000-000000000001',
    'client_invoice',
    'P0-FD-REGRESSION-00001',
    'p0_regression',
    'cccccccc-0001-4000-8000-000000000099',
    v_client_id,
    'USD',
    100, 14, 114,
    'posted'
  )
  ON CONFLICT (id) DO UPDATE
    SET client_id = EXCLUDED.client_id,
        status = EXCLUDED.status
  RETURNING id INTO v_doc_id;

  IF v_doc_id IS NULL THEN
    v_doc_id := 'cccccccc-0001-4000-8000-000000000001';
  END IF;

  INSERT INTO public.md_currencies (code, name, symbol, decimal_places, is_active)
  VALUES ('P0T', 'P0 Test Currency', 'P', 2, true)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO public.md_exchange_rates (
    id, from_currency, to_currency, exchange_rate,
    effective_start_date, is_active, source
  )
  VALUES (
    'dddddddd-0001-4000-8000-000000000001',
    'USD', 'P0T', 1.25,
    CURRENT_DATE, true, 'p0_regression'
  )
  ON CONFLICT (id) DO UPDATE SET exchange_rate = EXCLUDED.exchange_rate
  RETURNING id INTO v_rate_id;

  IF v_rate_id IS NULL THEN
    v_rate_id := 'dddddddd-0001-4000-8000-000000000001';
  END IF;

  -- -------------------------------------------------------------------------
  -- 1) Viewer cannot modify finance data
  -- -------------------------------------------------------------------------
  PERFORM tw_p0_finance_fx_test.set_auth(v_viewer_id);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_cnt
  FROM public.finance_documents
  WHERE id = v_doc_id;

  IF v_cnt <> 0 THEN
    PERFORM tw_p0_finance_fx_test.fail('Viewer can SELECT finance_documents');
  END IF;

  BEGIN
    UPDATE public.finance_documents
    SET status = 'tampered_by_viewer'
    WHERE id = v_doc_id;
    IF FOUND THEN
      PERFORM tw_p0_finance_fx_test.fail('Viewer can UPDATE finance_documents');
    END IF;
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    NULL;
  END;

  -- Confirm row unchanged (as table owner after reset)
  RESET ROLE;
  PERFORM tw_p0_finance_fx_test.clear_auth();

  IF EXISTS (
    SELECT 1 FROM public.finance_documents
    WHERE id = v_doc_id AND status = 'tampered_by_viewer'
  ) THEN
    PERFORM tw_p0_finance_fx_test.fail('Viewer UPDATE unexpectedly persisted');
  END IF;

  PERFORM tw_p0_finance_fx_test.pass('Viewer cannot modify finance data');

  -- -------------------------------------------------------------------------
  -- 2) Client portal cannot read finance data (even with client_users row)
  -- -------------------------------------------------------------------------
  PERFORM tw_p0_finance_fx_test.set_auth(v_client_portal_id);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_cnt
  FROM public.finance_documents
  WHERE id = v_doc_id;

  IF v_cnt <> 0 THEN
    PERFORM tw_p0_finance_fx_test.fail('Client portal can SELECT finance_documents');
  END IF;

  SELECT count(*) INTO v_cnt FROM public.md_exchange_rates WHERE id = v_rate_id;
  IF v_cnt <> 0 THEN
    PERFORM tw_p0_finance_fx_test.fail('Client portal can SELECT md_exchange_rates');
  END IF;

  RESET ROLE;
  PERFORM tw_p0_finance_fx_test.clear_auth();
  PERFORM tw_p0_finance_fx_test.pass('Client portal cannot read finance/FX data');

  -- -------------------------------------------------------------------------
  -- 3) Finance user can perform allowed actions
  -- -------------------------------------------------------------------------
  PERFORM tw_p0_finance_fx_test.set_auth(v_finance_id);
  SET LOCAL ROLE authenticated;

  IF NOT public.can_read_finance_control() OR NOT public.can_write_finance_control() THEN
    PERFORM tw_p0_finance_fx_test.fail('Finance role missing finance.read/write helpers');
  END IF;

  SELECT count(*) INTO v_cnt
  FROM public.finance_documents
  WHERE id = v_doc_id;

  IF v_cnt <> 1 THEN
    PERFORM tw_p0_finance_fx_test.fail('Finance user cannot SELECT finance_documents');
  END IF;

  UPDATE public.finance_documents
  SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('p0_finance_touch', true)
  WHERE id = v_doc_id;

  IF NOT FOUND THEN
    PERFORM tw_p0_finance_fx_test.fail('Finance user cannot UPDATE finance_documents');
  END IF;

  IF NOT public.can_write_exchange_rates() THEN
    PERFORM tw_p0_finance_fx_test.fail('Finance user lacks can_write_exchange_rates (needs finance.override)');
  END IF;

  UPDATE public.md_exchange_rates
  SET notes = 'touched_by_finance'
  WHERE id = v_rate_id;

  IF NOT FOUND THEN
    PERFORM tw_p0_finance_fx_test.fail('Finance user cannot UPDATE md_exchange_rates');
  END IF;

  RESET ROLE;
  PERFORM tw_p0_finance_fx_test.clear_auth();
  PERFORM tw_p0_finance_fx_test.pass('Finance user can read/write finance and FX');

  -- -------------------------------------------------------------------------
  -- 4) Admin retains access
  -- -------------------------------------------------------------------------
  PERFORM tw_p0_finance_fx_test.set_auth(v_admin_id);
  SET LOCAL ROLE authenticated;

  IF NOT public.is_admin() THEN
    PERFORM tw_p0_finance_fx_test.fail('Admin fixture is_admin() is false');
  END IF;

  SELECT count(*) INTO v_cnt
  FROM public.finance_documents
  WHERE id = v_doc_id;

  IF v_cnt <> 1 THEN
    PERFORM tw_p0_finance_fx_test.fail('Admin cannot SELECT finance_documents');
  END IF;

  UPDATE public.finance_documents
  SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('p0_admin_touch', true)
  WHERE id = v_doc_id;

  IF NOT FOUND THEN
    PERFORM tw_p0_finance_fx_test.fail('Admin cannot UPDATE finance_documents');
  END IF;

  SELECT count(*) INTO v_cnt FROM public.md_exchange_rates WHERE id = v_rate_id;
  IF v_cnt <> 1 THEN
    PERFORM tw_p0_finance_fx_test.fail('Admin cannot SELECT md_exchange_rates');
  END IF;

  RESET ROLE;
  PERFORM tw_p0_finance_fx_test.clear_auth();
  PERFORM tw_p0_finance_fx_test.pass('Admin retains finance/FX access');

  -- -------------------------------------------------------------------------
  -- 5) FX write denied without finance.override
  -- -------------------------------------------------------------------------
  PERFORM tw_p0_finance_fx_test.set_auth(v_ops_no_override_id);
  SET LOCAL ROLE authenticated;

  IF public.has_permission('finance.override') THEN
    PERFORM tw_p0_finance_fx_test.fail('Ops fixture still has finance.override');
  END IF;

  IF public.can_write_exchange_rates() THEN
    PERFORM tw_p0_finance_fx_test.fail('Ops without override can_write_exchange_rates');
  END IF;

  -- Internal ops may still SELECT rates
  SELECT count(*) INTO v_cnt FROM public.md_exchange_rates WHERE id = v_rate_id;
  IF v_cnt <> 1 THEN
    PERFORM tw_p0_finance_fx_test.fail('Ops internal user cannot SELECT md_exchange_rates');
  END IF;

  UPDATE public.md_exchange_rates
  SET notes = 'tampered_by_ops'
  WHERE id = v_rate_id;

  IF FOUND THEN
    PERFORM tw_p0_finance_fx_test.fail('Ops without finance.override updated md_exchange_rates');
  END IF;

  RESET ROLE;
  PERFORM tw_p0_finance_fx_test.clear_auth();

  IF EXISTS (
    SELECT 1 FROM public.md_exchange_rates
    WHERE id = v_rate_id AND notes = 'tampered_by_ops'
  ) THEN
    PERFORM tw_p0_finance_fx_test.fail('Ops FX write unexpectedly persisted');
  END IF;

  PERFORM tw_p0_finance_fx_test.pass('FX write denied without finance.override');

  -- -------------------------------------------------------------------------
  -- 6) Portal cannot read PO governance / finance notifications / campaign POs
  -- -------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'can_read_finance_control'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'po_governance_logs'
  ) THEN
    PERFORM tw_p0_finance_fx_test.set_auth(v_client_portal_id);
    SET LOCAL ROLE authenticated;

    SELECT count(*) INTO v_cnt FROM public.po_governance_logs;
    IF v_cnt <> 0 THEN
      PERFORM tw_p0_finance_fx_test.fail('Client portal can SELECT po_governance_logs');
    END IF;

    SELECT count(*) INTO v_cnt FROM public.finance_notifications;
    IF v_cnt <> 0 THEN
      PERFORM tw_p0_finance_fx_test.fail('Client portal can SELECT finance_notifications');
    END IF;

    SELECT count(*) INTO v_cnt FROM public.campaign_purchase_orders;
    IF v_cnt <> 0 THEN
      PERFORM tw_p0_finance_fx_test.fail('Client portal can SELECT campaign_purchase_orders');
    END IF;

    RESET ROLE;
    PERFORM tw_p0_finance_fx_test.clear_auth();
    PERFORM tw_p0_finance_fx_test.pass(
      'Client portal cannot read PO logs/notifications/purchase orders'
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- Policy hygiene: no USING(true)/WITH CHECK(true) on finance control tables
  -- -------------------------------------------------------------------------
  IF EXISTS (
    SELECT 1
    FROM pg_policy pol
    JOIN pg_class cls ON cls.oid = pol.polrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    WHERE nsp.nspname = 'public'
      AND cls.relname IN (
        'finance_documents',
        'finance_posting_batches',
        'erp_sync_queue',
        'finance_document_links',
        'client_credit_notes',
        'vendor_credit_notes',
        'client_debit_notes',
        'vendor_debit_notes',
        'md_exchange_rates',
        'po_governance_logs',
        'finance_notifications',
        'campaign_purchase_orders'
      )
      AND (
        pg_get_expr(pol.polqual, pol.polrelid) = 'true'
        OR pg_get_expr(pol.polwithcheck, pol.polrelid) = 'true'
      )
  ) THEN
    PERFORM tw_p0_finance_fx_test.fail(
      'Permissive true policies still present on finance/FX tables'
    );
  END IF;

  PERFORM tw_p0_finance_fx_test.pass('No USING(true)/WITH CHECK(true) on finance/FX tables');

  -- FORCE RLS on P0 finance tables
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'finance_documents',
        'po_governance_logs',
        'finance_notifications',
        'campaign_purchase_orders',
        'md_exchange_rates',
        'financial_periods'
      )
      AND c.relforcerowsecurity = false
  ) THEN
    PERFORM tw_p0_finance_fx_test.fail('FORCE ROW LEVEL SECURITY missing on a finance table');
  END IF;

  PERFORM tw_p0_finance_fx_test.pass('FORCE ROW LEVEL SECURITY set on finance tables');

  -- Restore operations finance.override grant (matches production seed/migrations)
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM public.roles r
  CROSS JOIN public.permissions p
  WHERE r.slug IN ('super_admin', 'admin', 'finance', 'operations')
    AND p.slug = 'finance.override'
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'P0 finance/FX RLS regression suite completed successfully.';
END $$;

-- Optional cleanup of fixture rows (keep users for re-runs; delete sensitive docs)
-- DELETE FROM public.finance_documents WHERE id = 'cccccccc-0001-4000-8000-000000000001';
-- DELETE FROM public.md_exchange_rates WHERE id = 'dddddddd-0001-4000-8000-000000000001';
