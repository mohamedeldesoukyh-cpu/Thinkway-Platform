-- Phase 1 Creator CRM migration validation (Dev/Prod).
-- Run: node scripts/psql-development.mjs -f scripts/validate-creator-crm-phase1.sql

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_status_count int;
  v_reason_count int;
  v_col boolean;
  v_trigger boolean;
  v_rls_profiles boolean;
  v_rls_events boolean;
  v_upd_events int;
  v_del_events int;
  v_test_inf uuid;
  v_flag boolean;
BEGIN
  SELECT count(*) INTO v_status_count
  FROM pg_type WHERE typname = 'creator_crm_status';
  IF v_status_count <> 1 THEN
    RAISE EXCEPTION 'creator_crm_status enum missing';
  END IF;

  SELECT count(*) INTO v_reason_count
  FROM pg_type WHERE typname = 'creator_crm_activation_reason';
  IF v_reason_count <> 1 THEN
    RAISE EXCEPTION 'creator_crm_activation_reason enum missing';
  END IF;

  IF to_regclass('public.creator_crm_profiles') IS NULL THEN
    RAISE EXCEPTION 'creator_crm_profiles missing';
  END IF;
  IF to_regclass('public.creator_crm_activation_events') IS NULL THEN
    RAISE EXCEPTION 'creator_crm_activation_events missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'influencers'
      AND column_name = 'has_commercial_profile'
  ) INTO v_col;
  IF NOT v_col THEN
    RAISE EXCEPTION 'influencers.has_commercial_profile missing';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_has_commercial_profile'
  ) INTO v_trigger;
  IF NOT v_trigger THEN
    RAISE EXCEPTION 'sync trigger missing';
  END IF;

  SELECT relrowsecurity INTO v_rls_profiles
  FROM pg_class WHERE oid = 'public.creator_crm_profiles'::regclass;
  SELECT relrowsecurity INTO v_rls_events
  FROM pg_class WHERE oid = 'public.creator_crm_activation_events'::regclass;
  IF NOT v_rls_profiles OR NOT v_rls_events THEN
    RAISE EXCEPTION 'RLS not enabled on CRM tables';
  END IF;

  SELECT count(*) INTO v_upd_events
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'creator_crm_activation_events'
    AND cmd = 'UPDATE';
  SELECT count(*) INTO v_del_events
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'creator_crm_activation_events'
    AND cmd = 'DELETE';
  IF v_upd_events > 0 OR v_del_events > 0 THEN
    RAISE EXCEPTION 'activation events must be append-only (no UPDATE/DELETE policies)';
  END IF;

  -- Trigger smoke test (rolled back)
  SELECT id INTO v_test_inf FROM public.influencers LIMIT 1;
  IF v_test_inf IS NOT NULL THEN
    BEGIN
      INSERT INTO public.creator_crm_profiles (
        influencer_id, activated_reason
      ) VALUES (v_test_inf, 'other');

      SELECT has_commercial_profile INTO v_flag
      FROM public.influencers WHERE id = v_test_inf;
      IF v_flag IS NOT TRUE THEN
        RAISE EXCEPTION 'has_commercial_profile not synced on insert';
      END IF;

      DELETE FROM public.creator_crm_profiles WHERE influencer_id = v_test_inf;

      SELECT has_commercial_profile INTO v_flag
      FROM public.influencers WHERE id = v_test_inf;
      IF v_flag IS NOT FALSE THEN
        RAISE EXCEPTION 'has_commercial_profile not cleared on delete';
      END IF;

      RAISE EXCEPTION 'rollback_trigger_test';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLERRM <> 'rollback_trigger_test' THEN
          RAISE;
        END IF;
    END;
  END IF;

  RAISE NOTICE 'creator_crm_phase1_validation_ok';
END;
$$;
