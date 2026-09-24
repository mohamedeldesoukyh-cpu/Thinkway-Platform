\set ON_ERROR_STOP on
-- Development integration regression; all fixtures and operational side effects roll back.
BEGIN;
SET LOCAL statement_timeout = '30s';
SELECT set_config('request.jwt.claim.sub', p.id::text, true)
FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
WHERE r.slug IN ('admin','super_admin') LIMIT 1;
CREATE TEMP TABLE crm_search_fixture (creator_id uuid, discovery_id uuid, campaign_id uuid, assignment_id uuid);
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_discovery uuid := gen_random_uuid();
  v_campaign uuid;
  v_assignment uuid;
  v_query text;
BEGIN
  SELECT id INTO v_campaign FROM public.campaigns LIMIT 1;
  IF v_campaign IS NULL THEN RAISE EXCEPTION 'Test requires a Development campaign'; END IF;
  INSERT INTO public.influencers(id, document_number, display_name, legal_name, slug, influencer_url)
  VALUES (v_id, 'TEST-CRM-' || v_id, 'Fixture Creator Zqv914', 'Milad Legal Zqv914', 'short-zqv914',
    'https://example.org/creator/zqv914'),
    (v_discovery, 'TEST-CRM-' || v_discovery, 'Discovery Zqv915', NULL, NULL, NULL);
  -- Insert trigger derives slugs from names; exercise a separately edited short slug.
  UPDATE public.influencers SET slug='short-zqv914' WHERE id=v_id;
  INSERT INTO public.influencer_platform_accounts(influencer_id, platform, handle, profile_url)
  VALUES (v_id, 'instagram', 'the_milad.zqv914', 'https://www.instagram.com/the_milad.zqv914/'),
    (v_id, 'tiktok', 'the_milad.zqv914', 'https://www.tiktok.com/@the_milad.zqv914'),
    (v_discovery, 'instagram', 'discovery_zqv915', 'https://instagram.com/discovery_zqv915');
  UPDATE public.influencer_platform_accounts SET profile_display_name='Public Alias Zqv914'
  WHERE influencer_id=v_id AND platform='instagram';

  IF EXISTS(SELECT 1 FROM public.creator_crm_profiles WHERE influencer_id IN (v_id,v_discovery)) THEN
    RAISE EXCEPTION 'Discovery identity creation activated CRM';
  END IF;
  FOREACH v_query IN ARRAY ARRAY['THE_MILAD.ZQV914', '@the_milad.zqv914', 'Milad zqv914',
    'Fixture Creator Zqv914', 'Milad Legal Zqv914', 'Public Alias Zqv914', 'short-zqv914', 'zqv914',
    'https://www.instagram.com/the_milad.zqv914/?igsh=abc',
    'instagram.com/the_milad.zqv914/', 'https://www.tiktok.com/@the_milad.zqv914?lang=en',
    'https://example.org/creator/zqv914'] LOOP
    IF (SELECT count(*) FROM public.search_vendor_identities(v_query) WHERE id=v_id) <> 1 THEN
      RAISE EXCEPTION 'Search failed or duplicated creator for %', v_query;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.search_vendor_identities('%') WHERE id=v_id)
    OR EXISTS(SELECT 1 FROM public.search_vendor_identities('@') WHERE id=v_id)
    OR EXISTS(SELECT 1 FROM public.search_vendor_identities('does-not-exist-zqv916')) THEN
    RAISE EXCEPTION 'Literal or empty normalized search matched unexpected records';
  END IF;

  INSERT INTO public.campaign_influencers(campaign_id,influencer_id)
  VALUES(v_campaign,v_id) RETURNING id INTO v_assignment;
  IF NOT EXISTS(SELECT 1 FROM public.creator_crm_profiles WHERE influencer_id=v_id)
    OR NOT (SELECT has_commercial_profile FROM public.influencers WHERE id=v_id) THEN
    RAISE EXCEPTION 'Assignment did not atomically activate CRM';
  END IF;
  UPDATE public.creator_crm_profiles SET crm_status='preferred' WHERE influencer_id=v_id;
  UPDATE public.campaign_influencers SET influencer_id=v_id WHERE id=v_assignment;
  IF (SELECT crm_status FROM public.creator_crm_profiles WHERE influencer_id=v_id) <> 'preferred'
    OR (SELECT count(*) FROM public.creator_crm_activation_events
        WHERE influencer_id=v_id AND source_entity_id=v_assignment AND reason='campaign_assignment') <> 1 THEN
    RAISE EXCEPTION 'Repeated assignment changed status or duplicated audit event';
  END IF;
  IF EXISTS(SELECT 1 FROM public.creator_crm_profiles WHERE influencer_id=v_discovery) THEN
    RAISE EXCEPTION 'Unrelated Discovery creator activated';
  END IF;
  INSERT INTO crm_search_fixture VALUES(v_id,v_discovery,v_campaign,v_assignment);
END;
$$;

-- Exercise the same authenticated scope used by the application, not only postgres.
SELECT set_config('request.jwt.claim.sub', p.id::text, true)
FROM public.profiles p JOIN public.roles r ON r.id=p.role_id
WHERE r.slug IN ('admin','super_admin') LIMIT 1;
SET LOCAL ROLE authenticated;
DO $$
DECLARE v_query text; v_rows bigint; v_total bigint;
BEGIN
  IF NOT public.has_permission('influencers.read') THEN RAISE EXCEPTION 'Missing test reader'; END IF;
  FOREACH v_query IN ARRAY ARRAY['zqv914','@the_milad.zqv914',
    'https://instagram.com/the_milad.zqv914/?igsh=abc', 'short-zqv914'] LOOP
    SELECT count(*) INTO v_rows FROM public.search_vendor_identities(v_query) WHERE has_commercial_profile;
    v_total := public.vendor_identity_search_total_count(v_query,NULL,NULL,true);
    IF v_rows <> 1 OR v_total <> v_rows THEN
      RAISE EXCEPTION 'Authenticated list/count mismatch for %: % / %',v_query,v_rows,v_total;
    END IF;
    IF public.vendor_identity_search_total_count(v_query,NULL,'instagram',true) <> 1
      OR public.vendor_identity_search_total_count(v_query,NULL,'youtube',true) <> 0 THEN
      RAISE EXCEPTION 'Platform filter mismatch';
    END IF;
  END LOOP;
  IF public.vendor_identity_search_total_count('zqv915',NULL,NULL,true) <> 0
    OR public.vendor_identity_search_total_count('zqv915',NULL,NULL,false) <> 1 THEN
    RAISE EXCEPTION 'CRM / inventory scope mismatch';
  END IF;
END;
$$;
RESET ROLE;
DO $$
DECLARE v_io uuid; v_creator uuid;
BEGIN
  SELECT id,influencer_id INTO v_io,v_creator FROM public.vendor_ios LIMIT 1;
  IF v_io IS NULL THEN RAISE EXCEPTION 'Test requires a Development Vendor IO'; END IF;
  DELETE FROM public.creator_crm_profiles WHERE influencer_id=v_creator;
  UPDATE public.vendor_ios SET influencer_id=v_creator WHERE id=v_io;
  IF NOT EXISTS(SELECT 1 FROM public.creator_crm_profiles WHERE influencer_id=v_creator)
    OR NOT (SELECT has_commercial_profile FROM public.influencers WHERE id=v_creator) THEN
    RAISE EXCEPTION 'Vendor IO did not restore CRM membership';
  END IF;
END;
$$;
-- No identity may leak to an authenticated caller without a profile/read permission.
SELECT set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.search_vendor_identities('zqv914'))
    OR public.vendor_identity_search_total_count('zqv914',NULL,NULL,true) <> 0 THEN
    RAISE EXCEPTION 'Search bypassed access controls';
  END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
\echo 'PASS: vendor identity search, membership, deduplication, counts, filters, and access controls'
