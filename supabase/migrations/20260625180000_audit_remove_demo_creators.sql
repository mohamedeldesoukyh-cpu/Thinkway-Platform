-- =============================================================================
-- Discovery creator audit — remove demo / mock_seed profiles only
-- Generated: 2026-06-25 (audit via scripts/audit-discovery-creators.ts)
--
-- SAFETY:
--   • Targets discovered_profiles ONLY (not influencers / vendor master data).
--   • Never deletes rows with influencer_id set (promoted to vendor).
--   • Never deletes rows linked to creator_import_files / creator_sources.
--   • Requires metadata.source = 'mock_seed' (discovery-worker mock-seed fallback).
--   • Explicit UUID allow-list from production audit (67 profiles).
--   • Cascades: discovery_sources, profile_metrics, profile_ai_scores,
--     discovery_shortlist_items, profile_relationships (FK ON DELETE CASCADE).
--
-- NOT EXECUTED AUTOMATICALLY — review docs/DISCOVERY_CREATOR_AUDIT.md first.
-- =============================================================================

DO $$
DECLARE
  v_demo_before integer;
  v_demo_deleted integer;
  v_rows_deleted integer;
  v_profiles_after integer;
  v_influencers_after integer;
BEGIN
  SELECT count(*)::integer
  INTO v_demo_before
  FROM public.discovered_profiles dp
  WHERE dp.influencer_id IS NULL
    AND COALESCE(dp.metadata->>'source', '') = 'mock_seed';

  RAISE NOTICE 'Pre-delete mock_seed discovered_profiles (unpromoted): %', v_demo_before;

  -- ---------------------------------------------------------------------------
  -- Criterion 1: explicit IDs from 2026-06-25 audit (67 rows)
  -- All usernames match tw_{category}_{country}_{nn} from mock-seed.ts
  -- ---------------------------------------------------------------------------
  DELETE FROM public.discovered_profiles dp
  WHERE dp.id IN (
    'b7a789d4-87b4-47c1-816a-848329afa63f',
    '6102efa9-5594-4e04-a278-88a9e178a631',
    '0c1e1afa-4399-4dcf-ae7b-f27e12ace5e7',
    'f79667b3-4169-469a-b67a-dc8fe7eeb6de',
    '2f2058bc-5198-403d-aeba-58e715aee761',
    '058b3c2f-f2e8-4ab1-8504-d2693a86b30d',
    'e1489523-82a1-4e53-9a8a-71cbed0a5c8b',
    '79a190ac-bcd6-4ed7-82c3-f25f18f6f58d',
    '8569f71b-52bb-444b-a201-876a0ad785a8',
    '6156ec81-fe7a-4239-8fef-0b240fd63456',
    '171d5e8f-e07b-4000-84a7-fe4d61b79508',
    '90f961c0-210d-431d-8048-7ba99e22bd08',
    'b0a2816d-4cd5-44d7-998e-7218b1176e23',
    '0c4b0b4d-1ccf-4c39-8a4b-429f5b128e39',
    '3d8af266-be31-490d-bdc7-992c2dc09bce',
    'f1c34e43-49b1-410b-89bb-2a1751fcd623',
    '16aaa505-f8fc-461e-a179-46eb50d74aae',
    '026c9f37-09d7-4506-8fe5-5ab010b5eff1',
    '9233bf1f-09db-4c03-bc98-5ece6ad417fb',
    '2e1a92da-2b81-4e08-866d-49da2e0187bd',
    '93e0e59d-f160-4da0-b6ea-b3f2b4062161',
    'd2306d3d-f476-4427-aded-20ed1f04a74c',
    '9773e913-2714-4d99-b700-e3c1793a3faa',
    '865a7177-bb9c-4af0-9a84-b81a6fd650da',
    '9ce88e1c-8ab3-4f9d-a3c4-e5cd152144d6',
    '83d9d53c-b0c2-4196-b0cd-88763d72d0c9',
    '93e5cb2c-2075-4370-85cd-9413a83be875',
    '4228209a-9c08-4007-a205-5a80068c742c',
    '5958e06d-6c9a-427e-87c5-46c4ec8f1a7e',
    '55c64a9f-6407-4739-9a4c-08cede5449fa',
    'd5153d5d-2e57-4468-ab93-14ff7bf5bdf0',
    '89f4dac3-ea04-48cf-80dc-ee6e6ef46ce4',
    'a2855db3-6075-4884-bef1-6434c844d33d',
    'd839a0b5-a963-4c19-898c-537d26c605fd',
    '5a76afd2-cbde-4d16-8577-b585286e4bd5',
    '098f4d8f-9ea2-443d-8638-7c6b5a6ea4d4',
    '9f20bd66-d6a2-4bd1-9a7a-ef3805211b7b',
    'e9e454c5-78a4-47ad-9859-f4b5edef2b88',
    '5eeb67c8-525e-4151-bd9c-ddf4b1b00b1c',
    'a3851cd9-5bc3-4e9a-82d8-301bfe28a004',
    'e7d971cb-24c7-424d-bf73-647dc1eec7fe',
    '999cda36-67ee-46e5-a4f1-e523f88ea7b6',
    '3dcdcc85-7c7c-41c1-9898-5c038d1e5d93',
    '5b985e26-2ab8-48bc-b4b0-02a59121a978',
    'd7ef0e86-b278-421e-af71-12b629493e69',
    '95a02b68-8c36-4454-9881-cea98d2aede9',
    '2fda202c-d223-400f-9040-845b2ad0af2c',
    'b83a1f33-1c75-4696-a570-d77121659baa',
    'd0680be8-7bb0-4406-a818-6069d10b1ed7',
    '7ef4ffb6-5a03-47f3-a175-99b70a1e375a',
    'a9f4c534-0c5d-4b80-b083-1e3d8d2dbaa4',
    '4fd73405-4b09-4c88-836f-4528f3ea244a',
    'f222dfaf-9a46-4709-912a-f5e320dec681',
    '8c220fa9-4062-413e-be80-284da09f4203',
    '7b239e99-8042-4854-857b-39a54b6fad3c',
    '4bd6e5c0-e451-4d8f-8b35-3962b4d68bc1',
    'bb228448-5926-4ed7-baaa-a05b5181ee0a',
    'b855888d-e763-4fed-868e-3c0298718f74',
    'd142ff61-de0d-4c58-b418-4e266e2d574f',
    '0ac79f26-385d-4fa2-bb0c-93de3952fa57',
    '2d49e7fd-bccc-45b1-af79-f303c7278dba',
    '9120e1e8-be56-4f31-8a75-53112fa8d503',
    'd0dec535-8012-40ee-98d4-6a89b4da31e8',
    'bbbdfbc3-db42-4c9e-9497-b4dc244ec0d6',
    '90dba1cc-1f37-45ab-9856-5e6fcfb3555e',
    'f1310459-f973-4095-952c-50180f5710aa',
    'c90e345d-1380-4a90-9e65-ff0dad8edb20'
  )
  AND dp.influencer_id IS NULL
  AND COALESCE(dp.metadata->>'source', '') = 'mock_seed';

  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
  v_demo_deleted := v_rows_deleted;

  -- ---------------------------------------------------------------------------
  -- Criterion 2: catch any future mock_seed stragglers (same username pattern)
  -- Pattern from services/discovery-worker/src/discovery/mock-seed.ts
  -- ---------------------------------------------------------------------------
  DELETE FROM public.discovered_profiles dp
  WHERE dp.influencer_id IS NULL
    AND COALESCE(dp.metadata->>'source', '') = 'mock_seed'
    AND dp.username ~ '^tw_[a-z0-9]+_[a-z]{2}_[0-9]{2}$';

  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
  v_demo_deleted := v_demo_deleted + v_rows_deleted;

  SELECT count(*)::integer INTO v_profiles_after FROM public.discovered_profiles;
  SELECT count(*)::integer INTO v_influencers_after FROM public.influencers;

  RAISE NOTICE 'Deleted mock_seed profiles: %', v_demo_deleted;
  RAISE NOTICE 'Remaining discovered_profiles: %', v_profiles_after;
  RAISE NOTICE 'Remaining influencers (unchanged): %', v_influencers_after;
  RAISE NOTICE 'Expected unified creator count after cleanup: %', v_influencers_after + v_profiles_after;
END $$;
